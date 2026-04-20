import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

// GET: list participants from confirmed bookings with teacher info.
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
            take: 500,
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

// PATCH: assign teacher to participant and prepare one evaluation link per booking slot.
export async function PATCH(req: NextRequest) {
    try {
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const { participantId, teacherId } = await req.json()

        const participant = await prisma.participant.update({
            where: { id: participantId },
            data: { teacherId },
            include: { booking: { include: { user: true } } },
        })

        if (teacherId) {
            await prisma.bookingItem.updateMany({
                where: {
                    bookingId: participant.bookingId,
                    OR: [
                        { teacherId: null },
                        { teacherId: { not: teacherId } },
                    ],
                },
                data: { teacherId, evaluationSent: false },
            })
        }

        const evaluationUrls: string[] = []
        if (teacherId) {
            const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://skibkk.com').replace(/\/$/, '')
            const bookingItems = await prisma.bookingItem.findMany({
                where: { bookingId: participant.bookingId },
                orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
            })

            for (const item of bookingItems) {
                let evaluation = await prisma.teacherEvaluation.findFirst({
                    where: { teacherId, bookingItemId: item.id },
                })

                if (!evaluation) {
                    evaluation = await prisma.teacherEvaluation.create({
                        data: {
                            teacherId,
                            bookingId: participant.bookingId,
                            bookingItemId: item.id,
                        },
                    })
                }

                evaluationUrls.push(`${baseUrl}/evaluate/${evaluation.token}`)
            }
        }

        return NextResponse.json({
            participant,
            evaluationUrl: evaluationUrls[0] || null,
            evaluationUrls,
            message: evaluationUrls.length > 0
                ? 'เลือกครูผู้สอนและสร้างลิงก์แบบประเมินแยกตามรอบเวลาแล้ว'
                : 'เลือกครูผู้สอนแล้ว',
        })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('PATCH /api/participants error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
