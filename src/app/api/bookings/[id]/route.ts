import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

type ParticipantNameInput = {
    id?: unknown
    name?: unknown
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth()
        const { id } = await params

        const booking = await prisma.booking.findUnique({
            where: { id },
            include: {
                bookingItems: {
                    include: {
                        court: { select: { name: true } },
                        teacher: { select: { id: true, name: true } },
                    },
                    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
                },
                participants: true,
                payments: { orderBy: { createdAt: 'desc' } },
                user: { select: { name: true, email: true, phone: true, lineDisplayName: true, lineAvatar: true } },
                invoice: true,
            },
        })

        if (!booking) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลการจอง' }, { status: 404 })
        }

        // Only allow access by the booking owner or admin
        if (booking.userId !== user.id && !['ADMIN', 'SUPERUSER'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        return NextResponse.json({ booking })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('Booking GET error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth()
        const { id } = await params
        const body = await req.json() as { participants?: unknown }
        const participantInputs = Array.isArray(body.participants)
            ? body.participants as ParticipantNameInput[]
            : null

        if (!participantInputs) {
            return NextResponse.json({ error: 'participants is required' }, { status: 400 })
        }

        const booking = await prisma.booking.findUnique({
            where: { id },
            include: { participants: true },
        })

        if (!booking) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลการจอง' }, { status: 404 })
        }

        if (booking.userId !== user.id && !['ADMIN', 'SUPERUSER'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const maxSetting = await prisma.siteSetting.findUnique({ where: { key: 'max_participants' } })
        const maxParticipants = Math.max(1, parseInt(maxSetting?.value || '2', 10) || 2)
        const participants: Array<{ id?: string; name: string }> = participantInputs.map(participant => ({
            id: typeof participant.id === 'string' ? participant.id : undefined,
            name: typeof participant.name === 'string' ? participant.name.trim() : '',
        }))

        if (participants.length < 1) {
            return NextResponse.json({ error: 'ต้องมีผู้เรียนอย่างน้อย 1 คน' }, { status: 400 })
        }
        if (participants.length > maxParticipants) {
            return NextResponse.json({ error: `เพิ่มผู้เรียนได้สูงสุด ${maxParticipants} คน` }, { status: 400 })
        }
        if (participants.some(participant => !participant.name)) {
            return NextResponse.json({ error: 'กรุณากรอกชื่อผู้เรียนให้ครบทุกคน' }, { status: 400 })
        }

        const existingParticipantIds = new Set(booking.participants.map(participant => participant.id))
        const submittedExistingIds = participants
            .map(participant => participant.id)
            .filter((participantId): participantId is string => Boolean(participantId))

        if (submittedExistingIds.some(participantId => !existingParticipantIds.has(participantId))) {
            return NextResponse.json({ error: 'ข้อมูลผู้เรียนไม่ถูกต้อง' }, { status: 400 })
        }

        const bookerParticipant = booking.participants.find(participant => participant.isBooker)
        if (bookerParticipant && !submittedExistingIds.includes(bookerParticipant.id)) {
            return NextResponse.json({ error: 'ไม่สามารถลบชื่อผู้จองออกจากรายการผู้เรียนได้' }, { status: 400 })
        }

        const defaultSportType = booking.participants[0]?.sportType || '-'

        await prisma.$transaction(async tx => {
            await tx.participant.deleteMany({
                where: {
                    bookingId: id,
                    isBooker: false,
                    id: { notIn: submittedExistingIds },
                },
            })

            for (const participant of participants) {
                if (participant.id) {
                    await tx.participant.update({
                        where: { id: participant.id },
                        data: { name: participant.name },
                    })
                } else {
                    await tx.participant.create({
                        data: {
                            bookingId: id,
                            name: participant.name,
                            sportType: defaultSportType,
                            isBooker: false,
                        },
                    })
                }
            }

            await tx.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'BOOKING_PARTICIPANTS_UPDATE',
                    entityType: 'booking',
                    entityId: id,
                    details: JSON.stringify({ bookingNumber: booking.bookingNumber, participantCount: participants.length }),
                },
            })
        })

        const updated = await prisma.booking.findUnique({
            where: { id },
            include: {
                bookingItems: {
                    include: {
                        court: { select: { name: true } },
                        teacher: { select: { id: true, name: true } },
                    },
                    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
                },
                participants: true,
                payments: { orderBy: { createdAt: 'desc' } },
                user: { select: { name: true, email: true, phone: true, lineDisplayName: true, lineAvatar: true } },
                invoice: true,
            },
        })

        return NextResponse.json({ booking: updated })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('Booking PATCH error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

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
        await prisma.invoice.deleteMany({ where: { bookingId: id } })
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
