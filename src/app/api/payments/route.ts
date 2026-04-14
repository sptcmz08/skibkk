import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getAuditRequestMeta } from '@/lib/audit'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth()
        const requestMeta = getAuditRequestMeta(req)
        const body = await req.json()

        const { bookingId, method, amount, slipData, manualReview } = body

        if (!bookingId || !amount || amount <= 0) {
            return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
        }

        // Verify booking exists and belongs to user
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

        // Duplicate slip detection
        let slipHash: string | null = null
        if (slipData) {
            slipHash = crypto.createHash('sha256').update(slipData).digest('hex')

            const existingSlip = await prisma.usedSlip.findUnique({
                where: { slipHash },
            })

            if (existingSlip) {
                await prisma.auditLog.create({
                    data: {
                        userId: user.id, action: 'BOOKING_FAIL', entityType: 'payment', entityId: bookingId,
                        ipAddress: requestMeta.ipAddress,
                        details: JSON.stringify({
                            reason: 'สลิปซ้ำ',
                            bookingNumber: booking.bookingNumber,
                            payment: { method: method || 'PROMPTPAY', amount, manualReview: Boolean(manualReview) },
                            request: requestMeta,
                        }),
                    },
                })
                return NextResponse.json(
                    { error: 'สลิปนี้ถูกใช้งานแล้ว ไม่สามารถใช้ซ้ำได้' },
                    { status: 400 }
                )
            }
        }

        const payment = await prisma.payment.create({
            data: {
                bookingId,
                userId: user.id,
                method: method || 'PROMPTPAY',
                amount,
                slipUrl: body.slipUrl || null,
                slipHash,
                status: manualReview ? 'PENDING' : 'VERIFIED',
                verifiedAt: manualReview ? null : new Date(),
                verifiedBy: manualReview ? null : 'SYSTEM',
            },
        })

        // Record used slip
        if (slipHash) {
            await prisma.usedSlip.create({
                data: {
                    slipHash,
                    paymentId: payment.id,
                },
            })
        }

        // Auto-confirm booking only if payment is verified (not manual review)
        if (!manualReview) {
            await prisma.booking.update({
                where: { id: bookingId },
                data: { status: 'CONFIRMED' },
            })
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
