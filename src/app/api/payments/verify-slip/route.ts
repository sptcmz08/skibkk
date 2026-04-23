import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
    parseReceiver,
    parseDisplayConfig,
    computePaymentChannelStatus,
    isReceiverComplete,
    receiverValuesMatch,
} from '@/lib/payment-channel'

type EasySlipV2Response = {
    success?: boolean
    message?: string
    error?: {
        code?: string
        message?: string
    }
    data?: {
        isDuplicate?: boolean
        matchedAccount?: {
            id?: string
            accountName?: string
            accountNumber?: string
            bankCode?: string
            bankName?: string
            nameTh?: string
            nameEn?: string
            bankNumber?: string
            bank?: {
                code?: string
                shortCode?: string
                nameTh?: string
                nameEn?: string
            }
        } | null
        amountInOrder?: number
        amountInSlip?: number
        isAmountMatched?: boolean
        rawSlip?: {
            transRef?: string
            date?: string
            amount?: { amount?: number | string }
            sender?: {
                bank?: { id?: string; name?: string; short?: string }
                account?: {
                    name?: { th?: string; en?: string }
                    value?: string
                }
            }
            receiver?: {
                bank?: { id?: string; name?: string; short?: string }
                account?: {
                    name?: { th?: string; en?: string }
                    value?: string
                }
                proxy?: {
                    type?: string
                    value?: string
                }
            }
        }
    }
}

type EasySlipMatchedAccount = NonNullable<NonNullable<EasySlipV2Response['data']>['matchedAccount']>

const VERIFY_ENDPOINT = 'https://api.easyslip.com/v2/verify/bank'
const MAX_IMAGE_SIZE = 4 * 1024 * 1024
const MIN_IMAGE_SIZE = 1000
const VERIFY_TIMEOUT_MS = 180000
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '')
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const createSlipVerificationToken = async (payload: {
    transRef: string
    amount: number
    sender: string
    receiverName: string
    receiverAccount: string
    receiverBankName: string
}) => {
    return new SignJWT({
        purpose: 'slip-verification',
        ...payload,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30m')
        .sign(JWT_SECRET)
}

const loadPaymentVerificationConfig = async () => {
    const [receiverSetting, displaySetting, qrSetting] = await Promise.all([
        prisma.siteSetting.findUnique({ where: { key: 'payment_receiver' } }),
        prisma.siteSetting.findUnique({ where: { key: 'payment_display_config' } }),
        prisma.siteSetting.findUnique({ where: { key: 'payment_qr_image' } }),
    ])

    const receiver = parseReceiver(receiverSetting?.value || null)
    const displayConfig = parseDisplayConfig(displaySetting?.value || null)
    const qrImage = qrSetting?.value || null
    const channelStatus = computePaymentChannelStatus({ qrImage, receiver, displayConfig })

    return { receiver, displayConfig, qrImage, channelStatus }
}

const isTransferPaymentEnabled = async () => {
    const { displayConfig } = await loadPaymentVerificationConfig()
    return displayConfig.enableQrCode !== false || displayConfig.enableBankDetails !== false
}

const verifySlipImage = async (imageFile: File): Promise<EasySlipV2Response> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

    try {
        const formData = new FormData()
        formData.append('image', imageFile)
        formData.append('checkDuplicate', 'true')

        const slipResponse = await fetch(VERIFY_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.EASYSLIP_API_KEY}`,
            },
            body: formData,
            signal: controller.signal,
        })

        const result = await slipResponse.json().catch(() => null) as EasySlipV2Response
        console.log('[SlipVerify] EasySlip response:', JSON.stringify(result))
        return result || { success: false, message: 'ไม่สามารถอ่านผลตรวจสลิปได้' }
    } catch (fetchError) {
        const isTimeout = (fetchError as Error).name === 'AbortError'
        console.error('[SlipVerify] EasySlip request failed:', isTimeout ? 'TIMEOUT' : fetchError)
        return { success: false, error: { message: isTimeout ? 'ระบบตรวจสลิปใช้เวลานานเกินไป' : 'ไม่สามารถเชื่อมต่อระบบตรวจสลิปได้' } }
    } finally {
        clearTimeout(timeout)
    }
}

const extractNameValue = (value?: { th?: string; en?: string } | null) => {
    return String(value?.th || value?.en || '').trim()
}

const extractNameCandidates = (value?: { th?: string; en?: string } | null) =>
    [value?.th, value?.en]
        .map(item => String(item || '').trim())
        .filter(Boolean)

const joinUniqueValues = (...values: Array<string | null | undefined>) =>
    [...new Set(values.map(item => String(item || '').trim()).filter(Boolean))].join('\n')

const getMatchedAccountName = (matchedAccount?: EasySlipMatchedAccount | null) =>
    String(matchedAccount?.accountName || matchedAccount?.nameTh || matchedAccount?.nameEn || '').trim()

const getMatchedAccountNumber = (matchedAccount?: EasySlipMatchedAccount | null) =>
    String(matchedAccount?.accountNumber || matchedAccount?.bankNumber || '').trim()

const getMatchedBankName = (matchedAccount?: EasySlipMatchedAccount | null) =>
    String(
        matchedAccount?.bankName
        || matchedAccount?.bank?.nameTh
        || matchedAccount?.bank?.nameEn
        || matchedAccount?.bank?.shortCode
        || matchedAccount?.bankCode
        || matchedAccount?.bank?.code
        || '',
    ).trim()

const getMatchedBankCode = (matchedAccount?: EasySlipMatchedAccount | null) =>
    String(matchedAccount?.bankCode || matchedAccount?.bank?.shortCode || matchedAccount?.bank?.code || '').trim()

export async function POST(req: NextRequest) {
    try {
        await requireAuth()
        const formData = await req.formData()
        const image = formData.get('image')

        if (!(await isTransferPaymentEnabled())) {
            return NextResponse.json({
                verified: false,
                error: 'ปิดการใช้งานการชำระเงินผ่านการโอนชั่วคราว',
            }, { status: 403 })
        }

        if (!(image instanceof File)) {
            return NextResponse.json({ error: 'กรุณาอัปโหลดรูปสลิป' }, { status: 400 })
        }

        const easySlipApiKey = process.env.EASYSLIP_API_KEY
        if (!easySlipApiKey) {
            return NextResponse.json({
                verified: false,
                error: 'ระบบตรวจสลิปอัตโนมัติยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ',
            }, { status: 500 })
        }

        const { receiver: expectedReceiver, channelStatus } = await loadPaymentVerificationConfig()
        if (!isReceiverComplete(expectedReceiver)) {
            return NextResponse.json({
                verified: false,
                error: 'ระบบชำระเงินยังตั้งค่าไม่ครบ กรุณาให้ผู้ดูแลกรอกชื่อบัญชี เลขบัญชี และธนาคารให้ครบก่อนใช้งาน',
            }, { status: 503 })
        }

        if (channelStatus.status !== 'ready') {
            return NextResponse.json({
                verified: false,
                error: 'ช่องทางชำระเงินยังไม่พร้อมใช้งาน กรุณาตรวจสอบรูปชำระเงินหรือข้อมูลบัญชีในหลังบ้าน',
            }, { status: 503 })
        }

        const activeReceiver = expectedReceiver!
        if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
            return NextResponse.json({
                verified: false,
                error: 'รูปสลิปไม่ถูกต้อง กรุณาลองอัปโหลดใหม่',
            }, { status: 400 })
        }

        if (image.size < MIN_IMAGE_SIZE) {
            return NextResponse.json({
                verified: false,
                error: 'ไฟล์รูปภาพไม่ถูกต้องหรือเสียหาย',
            }, { status: 400 })
        }

        if (image.size > MAX_IMAGE_SIZE) {
            return NextResponse.json({
                verified: false,
                error: 'ไฟล์สลิปใหญ่เกินไป กรุณาใช้รูปที่มีขนาดไม่เกิน 4MB',
            }, { status: 400 })
        }

        const result = await verifySlipImage(image)
        if (!result.success) {
            const errorCode = String(result.error?.code || '')
            const errorMessage = String(result.error?.message || result.message || '')

            console.error('[SlipVerify] EasySlip error:', JSON.stringify(result))

            if (errorCode === 'SLIP_PENDING' || errorMessage.toLowerCase() === 'slip_pending') {
                return NextResponse.json({
                    verified: false,
                    error: 'สลิปธนาคารกรุงเทพอาจใช้เวลา 1-5 นาทีในการตรวจสอบ กรุณารอสักครู่แล้วกดตรวจสอบใหม่',
                    debug: { code: errorCode, message: errorMessage },
                }, { status: 400 })
            }

            if (errorCode === 'IMAGE_SIZE_TOO_LARGE' || errorMessage.toLowerCase() === 'image_size_too_large') {
                return NextResponse.json({
                    verified: false,
                    error: 'ไฟล์สลิปใหญ่เกินไป กรุณาใช้รูปที่มีขนาดไม่เกิน 4MB',
                }, { status: 400 })
            }

            if (
                errorCode === 'VALIDATION_ERROR'
                || errorCode === 'UNSUPPORTED_FILE_TYPE'
                || errorMessage.toLowerCase().includes('invalid image')
                || errorMessage.toLowerCase() === 'invalid_image'
                || errorMessage.toLowerCase().includes('unsupported')
            ) {
                return NextResponse.json({
                    verified: false,
                    error: 'รูปสลิปไม่ถูกต้อง กรุณาใช้รูปสลิปจากแอปธนาคารโดยตรง',
                }, { status: 400 })
            }

            if (
                errorMessage.includes('ไม่พบ')
                || errorMessage.toLowerCase().includes('not found')
                || errorMessage.includes('No slip')
                || errorMessage.toLowerCase() === 'qrcode_not_found'
                || errorMessage.toLowerCase() === 'slip_not_found'
            ) {
                return NextResponse.json({
                    verified: false,
                    error: 'ไม่พบข้อมูลสลิปในรูปนี้ กรุณาใช้รูปสลิปที่บันทึกจากแอปธนาคารโดยตรง',
                }, { status: 400 })
            }

            return NextResponse.json({
                verified: false,
                error: `ตรวจสอบสลิปไม่สำเร็จ: ${errorMessage || 'กรุณาลองใหม่อีกครั้ง'}`,
            }, { status: 400 })
        }

        const slipData = result.data?.rawSlip
        const matchedAccount = result.data?.matchedAccount
        const amount = Number(result.data?.amountInSlip || slipData?.amount?.amount || 0)
        const transRef = String(slipData?.transRef || '').trim()
        const sender = extractNameValue(slipData?.sender?.account?.name)
        const displayReceiverName = extractNameValue(slipData?.receiver?.account?.name) || getMatchedAccountName(matchedAccount)
        const displayReceiverAccount = String(
            slipData?.receiver?.account?.value
            || slipData?.receiver?.proxy?.value
            || getMatchedAccountNumber(matchedAccount)
            || '',
        ).trim()
        const displayReceiverBankName = String(
            slipData?.receiver?.bank?.name
            || slipData?.receiver?.bank?.short
            || slipData?.receiver?.bank?.id
            || getMatchedBankName(matchedAccount)
            || getMatchedBankCode(matchedAccount)
            || '',
        ).trim()
        const receiverName = joinUniqueValues(
            ...extractNameCandidates(slipData?.receiver?.account?.name),
            getMatchedAccountName(matchedAccount),
        )
        const receiverAccount = joinUniqueValues(
            slipData?.receiver?.account?.value,
            slipData?.receiver?.proxy?.value,
            getMatchedAccountNumber(matchedAccount),
        )
        const receiverBankName = joinUniqueValues(
            slipData?.receiver?.bank?.name,
            slipData?.receiver?.bank?.short,
            slipData?.receiver?.bank?.id,
            getMatchedBankName(matchedAccount),
            getMatchedBankCode(matchedAccount),
        )
        const date = String(slipData?.date || '').trim()
        const bankCode = String(slipData?.sender?.bank?.short || slipData?.sender?.bank?.id || '').trim()

        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json({
                verified: false,
                error: 'ไม่พบจำนวนเงินในสลิป กรุณาลองใหม่',
            }, { status: 400 })
        }

        if (!transRef) {
            return NextResponse.json({
                verified: false,
                error: 'ไม่พบเลขอ้างอิงสลิป กรุณาใช้สลิปจากแอปธนาคารโดยตรง',
            }, { status: 400 })
        }

        if (result.data?.isDuplicate) {
            return NextResponse.json({
                verified: false,
                error: 'สลิปนี้ถูกใช้งานแล้ว ไม่สามารถใช้ซ้ำได้',
            }, { status: 400 })
        }

        const existingUsedSlip = await prisma.usedSlip.findFirst({
            where: { slipHash: transRef },
        })

        if (existingUsedSlip) {
            return NextResponse.json({
                verified: false,
                error: 'สลิปนี้ถูกใช้งานแล้ว ไม่สามารถใช้ซ้ำได้',
            }, { status: 400 })
        }

        const { matched } = receiverValuesMatch({
            name: receiverName,
            account: receiverAccount,
            bankName: receiverBankName,
        }, activeReceiver)

        if (!matched) {
            return NextResponse.json({
                verified: false,
                error: `สลิปนี้ไม่ได้โอนเข้าบัญชีที่ตั้งไว้ (ผู้รับ: ${displayReceiverName || displayReceiverAccount || 'ไม่ทราบ'} / ธนาคาร: ${displayReceiverBankName || 'ไม่ทราบ'})`,
            }, { status: 400 })
        }

        if (date) {
            const slipDate = new Date(date)
            if (!Number.isNaN(slipDate.getTime())) {
                const now = new Date()
                // diffMinutes > 0  → สลิปเก่ากว่าปัจจุบัน (ปกติ)
                // diffMinutes < 0  → สลิปอยู่ "ในอนาคต" (timezone offset หรือ clock drift)
                const diffMinutes = (now.getTime() - slipDate.getTime()) / (1000 * 60)

                if (diffMinutes > 30) {
                    return NextResponse.json({
                        verified: false,
                        error: `สลิปนี้เก่าเกินไป (${date}) กรุณาโอนใหม่ภายใน 30 นาที`,
                    }, { status: 400 })
                }

                // อนุญาต timezone offset ได้ถึง 8 ชั่วโมง (480 นาที)
                // เพราะ EasySlip อาจส่ง date เป็น UTC+0 หรือ timezone อื่น
                if (diffMinutes < -480) {
                    return NextResponse.json({
                        verified: false,
                        error: 'วันที่ในสลิปไม่ถูกต้อง กรุณาใช้สลิปจากแอปธนาคารโดยตรง',
                    }, { status: 400 })
                }
            }
        }

        const verificationToken = await createSlipVerificationToken({
            transRef,
            amount,
            sender,
            receiverName,
            receiverAccount,
            receiverBankName,
        })

        return NextResponse.json({
            verified: true,
            amount,
            transRef,
            sender,
            receiver: displayReceiverName,
            receiverAccount: displayReceiverAccount,
            receiverBankName: displayReceiverBankName,
            date,
            bankCode,
            verificationToken,
        })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }

        console.error('[SlipVerify] Unexpected error:', error)
        return NextResponse.json({
            verified: false,
            error: 'เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาลองใหม่อีกครั้ง',
        }, { status: 500 })
    }
}
