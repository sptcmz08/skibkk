import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, JWTPayload } from 'jose'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { sendLinePush } from '@/lib/line-messaging'
import { buildLineConfirmationMessage, DEFAULT_LINE_CONFIRMATION_NOTE } from '@/lib/line-booking-notify'
import {
    parseReceiver,
    parseDisplayConfig,
    computePaymentChannelStatus,
    isReceiverComplete,
    accountValuesMatch,
    bankValuesMatch,
    textValuesMatch,
} from '@/lib/payment-channel'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '')
const PAYMENT_TOLERANCE = 1

type SlipVerificationPayload = JWTPayload & {
    purpose?: string
    transRef?: string
    amount?: number
    sender?: string
    receiverName?: string
    receiverAccount?: string
    receiverBankName?: string
}

const formatLineDate = (date: Date | string) => new Date(date).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
})

const verifySlipToken = async (token: string) => {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const slip = payload as SlipVerificationPayload

    if (slip.purpose !== 'slip-verification') {
        throw new Error('INVALID_SLIP_TOKEN')
    }

    const transRef = String(slip.transRef || '').trim()
    const amount = Number(slip.amount || 0)

    if (!transRef || !Number.isFinite(amount) || amount <= 0) {
        throw new Error('INVALID_SLIP_TOKEN')
    }

    return {
        transRef,
        amount,
        sender: String(slip.sender || '').trim(),
        receiverName: String(slip.receiverName || '').trim(),
        receiverAccount: String(slip.receiverAccount || '').trim(),
        receiverBankName: String(slip.receiverBankName || '').trim(),
    }
}

const isTransferPaymentEnabled = async () => {
    const displaySetting = await prisma.siteSetting.findUnique({ where: { key: 'payment_display_config' } })
    const displayConfig = parseDisplayConfig(displaySetting?.value || null)
    return displayConfig.enableQrCode !== false || displayConfig.enableBankDetails !== false
}

const loadExpectedReceiver = async () => {
    const [receiverSetting, displaySetting, qrSetting] = await Promise.all([
        prisma.siteSetting.findUnique({ where: { key: 'payment_receiver' } }),
        prisma.siteSetting.findUnique({ where: { key: 'payment_display_config' } }),
        prisma.siteSetting.findUnique({ where: { key: 'payment_qr_image' } }),
    ])

    const receiver = parseReceiver(receiverSetting?.value || null)
    const displayConfig = parseDisplayConfig(displaySetting?.value || null)
    const qrImage = qrSetting?.value || null

    return {
        receiver,
        channelStatus: computePaymentChannelStatus({ receiver, displayConfig, qrImage }),
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth()
        const body = await req.json()

        const { bookingId, method, amount, slipData, manualReview } = body
        const slipTokens = Array.isArray(body.slipTokens)
            ? body.slipTokens.filter((token: unknown): token is string => typeof token === 'string' && token.trim().length > 0)
            : []

        if (!bookingId || !amount || Number(amount) <= 0) {
            return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
        })

        if (!booking) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลการจอง' }, { status: 404 })
        }

        if (booking.status === 'CANCELLED') {
            return NextResponse.json({ error: 'การจองนี้ถูกยกเลิกแล้ว' }, { status: 400 })
        }

        if (booking.status === 'CONFIRMED') {
            return NextResponse.json({ error: 'การจองนี้ชำระเงินแล้ว' }, { status: 400 })
        }

        if (booking.userId !== user.id && !['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        if (Math.abs(Number(amount) - booking.totalAmount) > PAYMENT_TOLERANCE) {
            return NextResponse.json({ error: 'ยอดชำระไม่ตรงกับยอดจอง' }, { status: 400 })
        }

        if (!(await isTransferPaymentEnabled())) {
            return NextResponse.json({ error: 'ปิดการใช้งานการชำระเงินผ่านการโอนชั่วคราว' }, { status: 403 })
        }

        const paymentMethod = method || 'PROMPTPAY'
        const payableAmount = booking.totalAmount
        let paymentSlipHash: string | null = null
        let verifiedSlipRefs: string[] = []
        let totalVerifiedAmount = 0

        if (slipTokens.length > 0) {
            let decodedSlips: Awaited<ReturnType<typeof verifySlipToken>>[]
            try {
                decodedSlips = await Promise.all(slipTokens.map((token: string) => verifySlipToken(token)))
            } catch {
                return NextResponse.json({ error: 'ข้อมูลการยืนยันสลิปไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสลิปใหม่' }, { status: 400 })
            }

            const { receiver: expectedReceiver, channelStatus } = await loadExpectedReceiver()
            if (channelStatus.status !== 'ready' || !isReceiverComplete(expectedReceiver)) {
                return NextResponse.json({ error: 'ระบบชำระเงินยังตั้งค่าไม่ครบ กรุณาให้ผู้ดูแลตรวจสอบข้อมูลบัญชีก่อนรับชำระ' }, { status: 503 })
            }

            const activeReceiver = expectedReceiver!
            const uniqueRefs = new Set<string>()

            for (const slip of decodedSlips) {
                const nameMatch = textValuesMatch(slip.receiverName, activeReceiver.name)
                const accountMatch = accountValuesMatch(slip.receiverAccount, activeReceiver.account)
                const bankMatch = bankValuesMatch(slip.receiverBankName, activeReceiver.bankName)

                if (!nameMatch || !accountMatch || !bankMatch) {
                    return NextResponse.json({ error: 'ข้อมูลสลิปไม่ตรงกับบัญชีที่ตั้งค่าอยู่ในระบบ กรุณาตรวจสลิปใหม่' }, { status: 400 })
                }

                if (uniqueRefs.has(slip.transRef)) {
                    return NextResponse.json({ error: 'พบสลิปซ้ำในรายการชำระ กรุณาตรวจสอบใหม่' }, { status: 400 })
                }

                uniqueRefs.add(slip.transRef)
                totalVerifiedAmount += slip.amount
            }

            if (totalVerifiedAmount + PAYMENT_TOLERANCE < payableAmount) {
                return NextResponse.json({ error: 'ยอดสลิปที่ตรวจสอบแล้วยังไม่ครบตามยอดจอง' }, { status: 400 })
            }

            verifiedSlipRefs = [...uniqueRefs]

            const existingUsedSlips = await prisma.usedSlip.findMany({
                where: { slipHash: { in: verifiedSlipRefs } },
                select: { slipHash: true },
            })

            if (existingUsedSlips.length > 0) {
                return NextResponse.json({ error: 'มีสลิปที่ถูกใช้งานไปแล้ว กรุณาตรวจสลิปใหม่' }, { status: 400 })
            }

            paymentSlipHash = verifiedSlipRefs.length === 1
                ? verifiedSlipRefs[0]
                : crypto.createHash('sha256').update(verifiedSlipRefs.sort().join('|')).digest('hex')
        } else if (slipData) {
            if (!manualReview) {
                return NextResponse.json({ error: 'กรุณาตรวจสอบสลิปก่อนยืนยันการชำระเงิน' }, { status: 400 })
            }
        } else if (!manualReview) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลสลิปที่ผ่านการตรวจสอบ กรุณาตรวจสลิปก่อนยืนยันการชำระเงิน' }, { status: 400 })
        }

        const payment = await prisma.$transaction(async tx => {
            const createdPayment = await tx.payment.create({
                data: {
                    bookingId,
                    userId: user.id,
                    method: paymentMethod,
                    amount: payableAmount,
                    slipUrl: body.slipUrl || null,
                    // Reserve slip references only after they pass verification.
                    slipHash: verifiedSlipRefs.length > 0 ? paymentSlipHash : null,
                    status: manualReview ? 'PENDING' : 'VERIFIED',
                    verifiedAt: manualReview ? null : new Date(),
                    verifiedBy: manualReview ? null : 'SYSTEM',
                },
            })

            for (const transRef of verifiedSlipRefs) {
                await tx.usedSlip.create({
                    data: {
                        slipHash: transRef,
                        paymentId: createdPayment.id,
                    },
                })
            }

            if (!manualReview) {
                await tx.booking.update({
                    where: { id: bookingId },
                    data: { status: 'CONFIRMED' },
                })
            }

            return createdPayment
        })

        if (!manualReview) {
            const confirmedBooking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: {
                    bookingItems: { include: { court: true } },
                    user: { select: { name: true, lineUserId: true } },
                },
            })

            if (confirmedBooking?.user?.lineUserId) {
                const templateSetting = await prisma.siteSetting.findUnique({ where: { key: 'line_booking_confirmation_template' } })
                const message = buildLineConfirmationMessage(templateSetting?.value || DEFAULT_LINE_CONFIRMATION_NOTE, {
                    bookingNumber: confirmedBooking.bookingNumber,
                    customerName: confirmedBooking.user.name,
                    items: confirmedBooking.bookingItems.map(item => ({
                        courtName: item.court.name,
                        date: formatLineDate(item.date),
                        startTime: item.startTime,
                        endTime: item.endTime,
                        price: item.price,
                    })),
                    totalAmount: confirmedBooking.totalAmount,
                })

                sendLinePush(
                    confirmedBooking.user.lineUserId,
                    [{ type: 'text', text: message }],
                    { messageType: 'payment_confirmation', bookingId: confirmedBooking.id },
                ).catch(err => console.error('Failed to send LINE confirmation:', err))
            }
        }

        return NextResponse.json({ payment }, { status: 201 })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }

        console.error('Payment POST error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
