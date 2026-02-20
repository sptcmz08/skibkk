import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth()
        const body = await req.json()

        const { bookingId, method, amount, slipData } = body

        // Verify booking exists and belongs to user
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
        })

        if (!booking) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลการจอง' }, { status: 404 })
        }

        if (booking.userId !== user.id && !['ADMIN', 'SUPERUSER'].includes(user.role)) {
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
                status: 'PENDING',
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

        // Auto-verify for mock (in production, use EasySlip API)
        // For now, mark as verified after a delay simulation
        if (process.env.AUTO_VERIFY_PAYMENTS === 'true') {
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'VERIFIED',
                    verifiedAt: new Date(),
                    verifiedBy: 'SYSTEM',
                },
            })

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
