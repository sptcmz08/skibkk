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
                    bank?: { account?: string }
                    proxy?: { account?: string; value?: string }
                }
            }
            receiver?: {
                bank?: { id?: string; name?: string; short?: string }
                account?: {
                    name?: { th?: string; en?: string }
                    value?: string
                    bank?: { account?: string }
                    proxy?: { account?: string; value?: string }
                }
                proxy?: {
                    type?: string
                    value?: string
                    account?: string
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
        // Let our own database reserve slips only after payment confirmation.
        // This avoids "used already" responses when verification fails for a
        // recoverable reason such as receiver matching or a temporary config issue.
        formData.append('checkDuplicate', 'false')
        // Ask EasySlip v2 to match the receiver with registered accounts for
        // better normalization across banks that abbreviate account names.
        formData.append('matchAccount', 'true')

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

const collectStringValues = (value: unknown, depth = 0): string[] => {
    if (depth > 5 || value == null) return []
    if (typeof value === 'string' || typeof value === 'number') {
        const text = String(value).trim()
        return text ? [text] : []
    }
    if (Array.isArray(value)) {
        return value.flatMap(item => collectStringValues(item, depth + 1))
    }
    if (typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).flatMap(item => collectStringValues(item, depth + 1))
    }
    return []
}

const verifySlipPayload = async (payload: string): Promise<EasySlipV2Response> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

    try {
        const slipResponse = await fetch(VERIFY_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.EASYSLIP_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                payload,
                checkDuplicate: false,
                matchAccount: true,
            }),
            signal: controller.signal,
        })

        const result = await slipResponse.json().catch(() => null) as EasySlipV2Response
        console.log('[SlipVerify] EasySlip payload response:', JSON.stringify(result))
        return result || { success: false, message: 'ไม่สามารถอ่านผลตรวจสลิปจาก QR ได้' }
    } catch (fetchError) {
        const isTimeout = (fetchError as Error).name === 'AbortError'
        console.error('[SlipVerify] EasySlip payload request failed:', isTimeout ? 'TIMEOUT' : fetchError)
        return { success: false, error: { message: isTimeout ? 'ระบบตรวจสลิปใช้เวลานานเกินไป' : 'ไม่สามารถเชื่อมต่อระบบตรวจสลิปด้วย QR ได้' } }
    } finally {
        clearTimeout(timeout)
    }
}

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

const getEasySlipErrorCode = (result: EasySlipV2Response | null | undefined) =>
    String(result?.error?.code || '').trim()

const getEasySlipErrorMessage = (result: EasySlipV2Response | null | undefined) =>
    String(result?.error?.message || result?.message || '').trim()

const isSlipPendingResult = (result: EasySlipV2Response | null | undefined) => {
    const code = getEasySlipErrorCode(result)
    const message = getEasySlipErrorMessage(result).toLowerCase()
    return code === 'SLIP_PENDING' || message === 'slip_pending' || message.includes('slip is pending')
}

export async function POST(req: NextRequest) {
    try {
        await requireAuth()
        const formData = await req.formData()
        const image = formData.get('image')
        const qrPayload = String(formData.get('payload') || '').trim()

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

        const payloadResult = qrPayload ? await verifySlipPayload(qrPayload) : null
        const result = payloadResult?.success || isSlipPendingResult(payloadResult)
            ? payloadResult!
            : await verifySlipImage(image)
        if (!result.success) {
            const errorCode = getEasySlipErrorCode(result)
            const errorMessage = getEasySlipErrorMessage(result)
            const debug = {
                reason: 'EASYSLIP_ERROR',
                code: errorCode || null,
                message: errorMessage || null,
                payloadFallback: Boolean(qrPayload),
                payloadMessage: payloadResult && !payloadResult.success
                    ? String(payloadResult.error?.message || payloadResult.message || '')
                    : null,
            }

            console.error('[SlipVerify] EasySlip error:', JSON.stringify(result))

            if (errorCode === 'SLIP_PENDING' || errorMessage.toLowerCase() === 'slip_pending') {
                return NextResponse.json({
                    verified: false,
                    error: 'ผู้ให้บริการยังประมวลผลสลิปนี้อยู่ กรุณารอสักครู่แล้วกดตรวจสอบใหม่',
                    debug,
                }, { status: 400 })
            }

            if (errorCode === 'IMAGE_SIZE_TOO_LARGE' || errorMessage.toLowerCase() === 'image_size_too_large') {
                return NextResponse.json({
                    verified: false,
                    error: 'ไฟล์สลิปใหญ่เกินไป กรุณาใช้รูปที่มีขนาดไม่เกิน 4MB',
                    debug,
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
                    debug,
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
                    debug,
                }, { status: 400 })
            }

            return NextResponse.json({
                verified: false,
                error: `ตรวจสอบสลิปไม่สำเร็จ: ${errorMessage || 'กรุณาลองใหม่อีกครั้ง'}`,
                debug,
            }, { status: 400 })
        }

        const slipData = result.data?.rawSlip
        const matchedAccount = result.data?.matchedAccount
        const receiverRawCandidates = collectStringValues(slipData?.receiver)
        const matchedAccountCandidates = collectStringValues(matchedAccount)
        const amount = Number(result.data?.amountInSlip || slipData?.amount?.amount || 0)
        const transRef = String(slipData?.transRef || '').trim()
        const sender = extractNameValue(slipData?.sender?.account?.name)
        const displayReceiverName = extractNameValue(slipData?.receiver?.account?.name) || getMatchedAccountName(matchedAccount)
        const displayReceiverAccount = String(
            slipData?.receiver?.account?.value
            || slipData?.receiver?.account?.bank?.account
            || slipData?.receiver?.account?.proxy?.account
            || slipData?.receiver?.account?.proxy?.value
            || slipData?.receiver?.proxy?.value
            || slipData?.receiver?.proxy?.account
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
            ...receiverRawCandidates,
            ...matchedAccountCandidates,
        )
        const receiverAccount = joinUniqueValues(
            slipData?.receiver?.account?.value,
            slipData?.receiver?.account?.bank?.account,
            slipData?.receiver?.account?.proxy?.account,
            slipData?.receiver?.account?.proxy?.value,
            slipData?.receiver?.proxy?.value,
            slipData?.receiver?.proxy?.account,
            getMatchedAccountNumber(matchedAccount),
            ...receiverRawCandidates,
            ...matchedAccountCandidates,
        )
        const receiverBankName = joinUniqueValues(
            slipData?.receiver?.bank?.name,
            slipData?.receiver?.bank?.short,
            slipData?.receiver?.bank?.id,
            getMatchedBankName(matchedAccount),
            getMatchedBankCode(matchedAccount),
            ...receiverRawCandidates,
            ...matchedAccountCandidates,
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

        const matchResult = receiverValuesMatch({
            name: receiverName,
            account: receiverAccount,
            bankName: receiverBankName,
        }, activeReceiver)
        const { matched } = matchResult
        const matchedByEasySlip = Boolean(matchedAccount)

        if (!(matched || matchedByEasySlip)) {
            const debug = {
                reason: 'RECEIVER_MISMATCH',
                match: {
                    name: matchResult.nameMatch,
                    account: matchResult.accountMatch,
                    bank: matchResult.bankMatch,
                    matchedByEasySlip,
                },
                actual: {
                    name: displayReceiverName || null,
                    account: displayReceiverAccount || null,
                    bank: displayReceiverBankName || null,
                },
                candidates: {
                    name: receiverName || null,
                    account: receiverAccount || null,
                    bank: receiverBankName || null,
                },
                expected: {
                    name: activeReceiver.name,
                    account: activeReceiver.account,
                    bank: activeReceiver.bankName,
                },
            }
            console.warn('[SlipVerify] Receiver mismatch:', JSON.stringify(debug))
            return NextResponse.json({
                verified: false,
                error: `สลิปนี้ไม่ได้โอนเข้าบัญชีที่ตั้งไว้ (ผู้รับ: ${displayReceiverName || displayReceiverAccount || 'ไม่ทราบ'} / ธนาคาร: ${displayReceiverBankName || 'ไม่ทราบ'})`,
                debug,
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
