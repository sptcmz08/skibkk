import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

// GET — list participants from confirmed bookings (with teacher info)
export async function GET() {
    try {
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const bookings = await prisma.booking.findMany({
            where: { status: { in: ['CONFIRMED', 'PENDING'] } },
            include: {
                user: { select: { name: true, email: true, phone: true, lineUserId: true } },
                bookingItems: { include: { court: true } },
                participants: {
                    include: { teacher: { select: { id: true, name: true } } },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        })

        const teachers = await prisma.teacher.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, specialty: true },
        })

        return NextResponse.json({ bookings, teachers })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('GET /api/participants error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// PATCH — assign teacher to participant + auto-create evaluation link
export async function PATCH(req: NextRequest) {
    try {
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const { participantId, teacherId } = await req.json()

        // Update participant
        const participant = await prisma.participant.update({
            where: { id: participantId },
            data: { teacherId },
            include: { booking: { include: { user: true } } },
        })

        // Auto-create evaluation link for this teacher+booking
        const existingEval = await prisma.teacherEvaluation.findFirst({
            where: { teacherId, bookingId: participant.bookingId },
        })

        let evaluationUrl = null
        if (!existingEval) {
            const evaluation = await prisma.teacherEvaluation.create({
                data: {
                    teacherId,
                    bookingId: participant.bookingId,
                },
            })
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://skibkk.com'
            evaluationUrl = `${baseUrl}/evaluate/${evaluation.token}`
        }

        return NextResponse.json({
            participant,
            evaluationUrl,
            message: evaluationUrl ? 'เลือกครูผู้สอนและสร้างลิงก์แบบประเมินอัตโนมัติแล้ว' : 'เลือกครูผู้สอนแล้ว',
        })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('PATCH /api/participants error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
