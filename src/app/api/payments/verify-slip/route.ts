import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
    parseReceiver,
    parseDisplayConfig,
    computePaymentChannelStatus,
    isReceiverComplete,
    normalizeAccountValue,
    normalizeTextValue,
} from '@/lib/payment-channel'

type EasySlipResult = {
    status?: number
    message?: string
    data?: {
        amount?: { amount?: number | string }
        transRef?: string
        date?: string
        sendingBank?: string
        sender?: {
            displayName?: string
            name?: string
        }
        receiver?: {
            displayName?: string
            name?: string
            account?: {
                value?: string
                bank?: {
                    short?: string
                    name?: string
                }
            }
            proxy?: {
                name?: string
                value?: string
            }
        }
    }
}

const VERIFY_ENDPOINT = 'https://developer.easyslip.com/api/v1/verify'
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
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
                error: 'ไฟล์ใหญ่เกินไป (สูงสุด 10MB)',
            }, { status: 400 })
        }

        const mimeType = mimeMatch[1]
        let extension = mimeType.split('/')[1] || 'jpg'
        if (extension === 'jpeg') extension = 'jpg'

        const formData = new FormData()
        const blob = new Blob([binaryData], { type: mimeType })
        formData.append('file', blob, `slip.${extension}`)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

        let easySlipResponse: Response
        try {
            easySlipResponse = await fetch(VERIFY_ENDPOINT, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${easySlipApiKey}`,
                },
                body: formData,
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

        let result: EasySlipResult
        try {
            result = await easySlipResponse.json()
        } catch {
            console.error('[SlipVerify] Failed to parse EasySlip response:', easySlipResponse.status)
            return NextResponse.json({
                verified: false,
                error: 'ระบบตรวจสลิปส่งข้อมูลผิดรูปแบบ กรุณาลองใหม่',
            }, { status: 500 })
        }

        if (!easySlipResponse.ok || result.status !== 200) {
            const errorMessage = result.data && 'message' in result.data
                ? String((result.data as Record<string, unknown>).message || '')
                : (result.message || '')
            const statusCode = result.status || easySlipResponse.status

            console.error('[SlipVerify] EasySlip error:', JSON.stringify(result))

            if (
                statusCode === 404
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

        const slipData = result.data
        const amount = Number(slipData?.amount?.amount || 0)
        const transRef = String(slipData?.transRef || '').trim()
        const sender = String(slipData?.sender?.displayName || slipData?.sender?.name || '').trim()
        const receiverName = String(slipData?.receiver?.displayName || slipData?.receiver?.name || slipData?.receiver?.proxy?.name || '').trim()
        const receiverAccount = String(slipData?.receiver?.account?.value || slipData?.receiver?.proxy?.value || '').trim()
        const receiverBankName = String(slipData?.receiver?.account?.bank?.name || slipData?.receiver?.account?.bank?.short || '').trim()
        const date = String(slipData?.date || '').trim()
        const bankCode = String(slipData?.sendingBank || '').trim()

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

        const [existingPayment, existingUsedSlip] = await Promise.all([
            prisma.payment.findFirst({ where: { slipHash: transRef } }),
            prisma.usedSlip.findFirst({ where: { slipHash: transRef } }),
        ])

        if (existingPayment || existingUsedSlip) {
            return NextResponse.json({
                verified: false,
                error: 'สลิปนี้ถูกใช้งานแล้ว ไม่สามารถใช้ซ้ำได้',
            }, { status: 400 })
        }

        const nameMatch = normalizeTextValue(receiverName).includes(normalizeTextValue(activeReceiver.name))
        const accountMatch = normalizeAccountValue(receiverAccount) === normalizeAccountValue(activeReceiver.account)
        const bankMatch = normalizeTextValue(receiverBankName).includes(normalizeTextValue(activeReceiver.bankName))

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
                const diffMinutes = (now.getTime() - slipDate.getTime()) / (1000 * 60)

                if (diffMinutes > 20) {
                    return NextResponse.json({
                        verified: false,
                        error: `สลิปนี้เก่าเกินไป (${date}) กรุณาโอนใหม่ภายใน 20 นาที`,
                    }, { status: 400 })
                }

                if (diffMinutes < -5) {
                    return NextResponse.json({
                        verified: false,
                        error: 'วันที่ในสลิปไม่ถูกต้อง',
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
