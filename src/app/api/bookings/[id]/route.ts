import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth()
        const { id } = await params

        const booking = await prisma.booking.findUnique({
            where: { id },
            include: { payments: true },
        })

        if (!booking) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลการจอง' }, { status: 404 })
        }

        // Only allow deletion by the booking owner or admin, and only if PENDING
        if (booking.userId !== user.id && !['ADMIN', 'SUPERUSER'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        if (booking.status !== 'PENDING') {
            return NextResponse.json({ error: 'ไม่สามารถลบการจองที่ยืนยันแล้ว' }, { status: 400 })
        }

        // Delete in order: usedSlips → payments → booking items → participants → booking
        const payments = await prisma.payment.findMany({ where: { bookingId: id }, select: { slipHash: true } })
        const slipHashes = payments.map(p => p.slipHash).filter((h): h is string => !!h)
        if (slipHashes.length > 0) {
            await prisma.usedSlip.deleteMany({ where: { slipHash: { in: slipHashes } } })
        }
        await prisma.payment.deleteMany({ where: { bookingId: id } })
        await prisma.bookingItem.deleteMany({ where: { bookingId: id } })
        await prisma.participant.deleteMany({ where: { bookingId: id } })
        await prisma.teacherEvaluation.deleteMany({ where: { bookingId: id } })
        await prisma.booking.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('Booking DELETE error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
