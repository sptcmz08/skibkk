import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { sendLineEvaluationRequest } from '@/lib/line-messaging'

const formatEvaluationDate = (date: Date) => new Date(date).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
})

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const body = await req.json() as { bookingItemId?: string }
        if (!body.bookingItemId) {
            return NextResponse.json({ error: 'bookingItemId is required' }, { status: 400 })
        }

        const item = await prisma.bookingItem.findUnique({
            where: { id: body.bookingItemId },
            include: {
                court: { select: { name: true } },
                teacher: { select: { id: true, name: true } },
                booking: {
                    include: {
                        user: { select: { name: true, lineUserId: true } },
                        participants: {
                            where: { teacherId: { not: null } },
                            include: { teacher: { select: { id: true, name: true } } },
                        },
                    },
                },
            },
        })

        if (!item) {
            return NextResponse.json({ error: 'ไม่พบรอบเวลาจอง' }, { status: 404 })
        }
        if (item.booking.status !== 'CONFIRMED') {
            return NextResponse.json({ error: 'ส่งได้เฉพาะ booking ที่ยืนยันแล้ว' }, { status: 400 })
        }

        const lineUserId = item.booking.user.lineUserId
        if (!lineUserId) {
            return NextResponse.json({ error: 'ลูกค้ายังไม่ได้เชื่อม LINE' }, { status: 400 })
        }

        const fallbackParticipant = item.booking.participants.find(participant => participant.teacherId && participant.teacher)
        const teacherId = item.teacherId || fallbackParticipant?.teacherId
        const teacherName = item.teacher?.name || fallbackParticipant?.teacher?.name
        if (!teacherId) {
            return NextResponse.json({ error: 'กรุณาเลือกครูผู้สอนก่อน' }, { status: 400 })
        }

        let evaluation = await prisma.teacherEvaluation.findFirst({
            where: { bookingItemId: item.id, teacherId },
        })

        if (!evaluation) {
            evaluation = await prisma.teacherEvaluation.create({
                data: {
                    teacherId,
                    bookingId: item.bookingId,
                    bookingItemId: item.id,
                },
            })
        }

        if (evaluation.isSubmitted) {
            return NextResponse.json({ error: 'ลูกค้าส่งแบบประเมินรอบนี้แล้ว จึงส่งซ้ำไม่ได้' }, { status: 400 })
        }

        const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://skibkk.com').replace(/\/$/, '')
        const evaluationUrl = `${baseUrl}/evaluate/${evaluation.token}`
        const result = await sendLineEvaluationRequest(lineUserId, {
            customerName: item.booking.user.name || 'ลูกค้า',
            teacherName: teacherName || 'ครูผู้สอน',
            evaluationUrl,
            courtName: item.court.name,
            date: formatEvaluationDate(item.date),
            startTime: item.startTime,
            endTime: item.endTime,
            bookingId: item.bookingId,
        })

        if (!result.success) {
            return NextResponse.json({ error: 'ส่ง LINE ไม่สำเร็จ', details: result.error }, { status: 502 })
        }

        await prisma.bookingItem.update({
            where: { id: item.id },
            data: { evaluationSent: true },
        })

        return NextResponse.json({
            success: true,
            evaluationUrl,
            message: 'ส่งแบบประเมินเข้า LINE แล้ว',
        })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('POST /api/evaluations/send error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
