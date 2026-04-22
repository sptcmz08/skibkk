import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
    parseReceiver,
    parseDisplayConfig,
    computePaymentChannelStatus,
    isReceiverComplete,
    accountValuesMatch,
    bankValuesMatch,
    textValuesMatch,
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

const VERIFY_ENDPOINT = 'https://api.easyslip.com/v2/verify/bank'
const MAX_IMAGE_SIZE = 4 * 1024 * 1024
const MIN_IMAGE_SIZE = 1000
const VERIFY_TIMEOUT_MS = 15000
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '')

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

const extractNameValue = (value?: { th?: string; en?: string } | null) => {
    return String(value?.th || value?.en || '').trim()
}

export async function POST(req: NextRequest) {
    try {
        await requireAuth()
        const { image } = await req.json()

        if (!(await isTransferPaymentEnabled())) {
            return NextResponse.json({
                verified: false,
                error: 'ปิดการใช้งานการชำระเงินผ่านการโอนชั่วคราว',
            }, { status: 403 })
        }

        if (!image) {
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
        const mimeMatch = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/)
        if (!mimeMatch) {
            return NextResponse.json({
                verified: false,
                error: 'รูปสลิปไม่ถูกต้อง กรุณาลองอัปโหลดใหม่',
            }, { status: 400 })
        }

        const base64Data = image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
        const binaryData = Buffer.from(base64Data, 'base64')

        if (binaryData.length < MIN_IMAGE_SIZE) {
            return NextResponse.json({
                verified: false,
                error: 'ไฟล์รูปภาพไม่ถูกต้องหรือเสียหาย',
            }, { status: 400 })
        }

        if (binaryData.length > MAX_IMAGE_SIZE) {
            return NextResponse.json({
                verified: false,
                error: 'ไฟล์สลิปใหญ่เกินไป กรุณาใช้รูปที่มีขนาดไม่เกิน 4MB',
            }, { status: 400 })
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

        let easySlipResponse: Response
        try {
            easySlipResponse = await fetch(VERIFY_ENDPOINT, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${easySlipApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    base64: image,
                    // Let our own database be the source of truth for duplicate prevention.
                    // This avoids provider-level duplicate flags before the slip is actually used.
                    checkDuplicate: false,
                }),
                signal: controller.signal,
            })
        } catch (fetchError) {
            const isTimeout = (fetchError as Error).name === 'AbortError'
            console.error('[SlipVerify] EasySlip request failed:', isTimeout ? 'TIMEOUT' : fetchError)
            return NextResponse.json({
                verified: false,
                error: isTimeout
                    ? 'ระบบตรวจสลิปตอบช้าเกินไป กรุณาลองใหม่อีกครั้ง'
                    : 'ไม่สามารถเชื่อมต่อระบบตรวจสลิปได้ กรุณาลองใหม่อีกครั้ง',
            }, { status: 500 })
        } finally {
            clearTimeout(timeout)
        }

        let result: EasySlipV2Response
        try {
            result = await easySlipResponse.json()
        } catch {
            console.error('[SlipVerify] Failed to parse EasySlip response:', easySlipResponse.status)
            return NextResponse.json({
                verified: false,
                error: 'ระบบตรวจสลิปส่งข้อมูลผิดรูปแบบ กรุณาลองใหม่',
            }, { status: 500 })
        }

        if (!easySlipResponse.ok || !result.success) {
            const errorCode = String(result.error?.code || '')
            const errorMessage = String(result.error?.message || result.message || '')

            console.error('[SlipVerify] EasySlip error:', JSON.stringify(result))

            if (errorCode === 'SLIP_PENDING') {
                return NextResponse.json({
                    verified: false,
                    acceptManualReview: true,
                    isBankPending: true,
                    error: 'สลิปธนาคารกรุงเทพเพิ่งทำรายการไม่นาน กรุณารอ 3-5 นาทีแล้วกดตรวจสอบสลิปอีกครั้ง',
                }, { status: 400 })
            }

            if (errorCode === 'IMAGE_SIZE_TOO_LARGE') {
                return NextResponse.json({
                    verified: false,
                    error: 'ไฟล์สลิปใหญ่เกินไป กรุณาใช้รูปที่มีขนาดไม่เกิน 4MB',
                }, { status: 400 })
            }

            if (
                errorCode === 'VALIDATION_ERROR'
                || errorCode === 'UNSUPPORTED_FILE_TYPE'
                || errorMessage.toLowerCase().includes('invalid base64')
                || errorMessage.toLowerCase().includes('unsupported')
            ) {
                return NextResponse.json({
                    verified: false,
                    error: 'รูปสลิปไม่ถูกต้อง กรุณาใช้รูปสลิปจากแอปธนาคารโดยตรง',
                }, { status: 400 })
            }

            if (
                easySlipResponse.status === 404
                || errorMessage.includes('ไม่พบ')
                || errorMessage.toLowerCase().includes('not found')
                || errorMessage.includes('No slip')
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
        const receiverName = extractNameValue(slipData?.receiver?.account?.name) || String(matchedAccount?.accountName || '').trim()
        const receiverAccount = String(
            slipData?.receiver?.account?.value
            || slipData?.receiver?.proxy?.value
            || matchedAccount?.accountNumber
            || '',
        ).trim()
        const receiverBankName = String(
            slipData?.receiver?.bank?.name
            || slipData?.receiver?.bank?.short
            || matchedAccount?.bankName
            || matchedAccount?.bankCode
            || '',
        ).trim()
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

        const nameMatch = textValuesMatch(receiverName, activeReceiver.name)
        const accountMatch = accountValuesMatch(receiverAccount, activeReceiver.account)
        const bankMatch = bankValuesMatch(receiverBankName, activeReceiver.bankName)

        if (!nameMatch || !accountMatch || !bankMatch) {
            return NextResponse.json({
                verified: false,
                error: `สลิปนี้ไม่ได้โอนเข้าบัญชีที่ตั้งไว้ (ผู้รับ: ${receiverName || receiverAccount || 'ไม่ทราบ'} / ธนาคาร: ${receiverBankName || 'ไม่ทราบ'})`,
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
            receiver: receiverName,
            receiverAccount,
            receiverBankName,
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
