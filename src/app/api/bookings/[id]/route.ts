import { NextRequest, NextResponse } from 'next/server'
import type { DayOfWeek } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getAuditRequestMeta } from '@/lib/audit'
import { getDayOfWeek, resolveSlotPrice } from '@/lib/utils'
import { expandSlotStartTimes, getSlotHourRange, normalizeDateOnly, slotRangesOverlap } from '@/lib/booking-slots'
import { publishRealtimeEvent } from '@/lib/realtime-events'

const RESCHEDULE_MIN_NOTICE_DAYS = 7
const toDateNoonUTC = (dateStr: string) => new Date(`${dateStr.split('T')[0]}T12:00:00Z`)
const toBangkokDateTime = (dateStr: string, time: string) => new Date(`${dateStr.split('T')[0]}T${time}:00+07:00`)

const summarizeParticipantForAudit = (participant: {
    id?: string
    name: string
    sportType?: string | null
    phone?: string | null
    height?: number | null
    weight?: number | null
    shoeSize?: string | null
    isBooker?: boolean | null
}) => ({
    id: participant.id,
    name: participant.name,
    sportType: participant.sportType || null,
    phone: participant.phone || null,
    height: participant.height || null,
    weight: participant.weight || null,
    shoeSize: participant.shoeSize || null,
    isBooker: Boolean(participant.isBooker),
})

type ParticipantInput = {
    id?: unknown
    name?: unknown
    sportType?: unknown
    age?: unknown
    shoeSize?: unknown
    weight?: unknown
    height?: unknown
    phone?: unknown
}

type RescheduleItemInput = {
    id?: unknown
    date?: unknown
    startTime?: unknown
    endTime?: unknown
}

const summarizeBookingItemForAudit = (item: {
    id?: string
    courtId: string
    court?: { name?: string | null } | null
    date: Date | string
    startTime: string
    endTime: string
    price: number
}) => ({
    id: item.id,
    courtId: item.courtId,
    courtName: item.court?.name || item.courtId,
    date: normalizeDateOnly(item.date),
    startTime: item.startTime,
    endTime: item.endTime,
    price: item.price,
})

const resolveBookingItemPrice = async (courtId: string, date: string, startTime: string, endTime: string) => {
    const selectedDate = toDateNoonUTC(date)
    const dayOfWeek = getDayOfWeek(selectedDate) as DayOfWeek
    const rules = await prisma.pricingRule.findMany({
        where: {
            isActive: true,
            daysOfWeek: { has: dayOfWeek },
            OR: [{ courtId }, { courtId: null }],
            AND: [
                { OR: [{ validFrom: null }, { validFrom: { lte: selectedDate } }] },
                { OR: [{ validTo: null }, { validTo: { gte: selectedDate } }] },
            ],
        },
        orderBy: { priority: 'desc' },
    })

    return expandSlotStartTimes({ startTime, endTime }).reduce((sum, time) => sum + resolveSlotPrice(time, rules), 0)
}

const validateCourtOpen = async (courtId: string, date: string, startTime: string, endTime: string) => {
    const selectedDate = toDateNoonUTC(date)
    const startOfDay = new Date(`${date}T00:00:00Z`)
    const endOfDay = new Date(`${date}T23:59:59Z`)
    const specialClosed = await prisma.specialClosedDate.findFirst({
        where: { date: { gte: startOfDay, lte: endOfDay } },
    })
    if (specialClosed) return false

    const dayOfWeek = getDayOfWeek(selectedDate) as DayOfWeek
    const court = await prisma.court.findUnique({
        where: { id: courtId },
        include: { operatingHours: { where: { dayOfWeek } } },
    })

    if (!court || court.status !== 'ACTIVE') return false
    const hours = court.operatingHours[0]
    if (!hours || hours.isClosed) return false

    const slotRange = getSlotHourRange({ startTime, endTime })
    const openRange = getSlotHourRange({ startTime: hours.openTime, endTime: hours.closeTime })
    if (!slotRange || !openRange) return false

    return slotRange.startHour >= openRange.startHour && slotRange.endHour <= openRange.endHour
}

const findRescheduleConflict = async (
    bookingId: string,
    items: Array<{ id: string; courtId: string; date: string; startTime: string; endTime: string }>
) => {
    for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
            if (items[i].courtId === items[j].courtId && items[i].date === items[j].date && slotRangesOverlap(items[i], items[j])) {
                return items[i]
            }
        }
    }

    for (const item of items) {
        const existingItems = await prisma.bookingItem.findMany({
            where: {
                courtId: item.courtId,
                date: toDateNoonUTC(item.date),
                booking: { status: { not: 'CANCELLED' }, id: { not: bookingId } },
            },
        })

        if (existingItems.some(existing => slotRangesOverlap(item, existing))) {
            return item
        }
    }

    return null
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
        const requestMeta = getAuditRequestMeta(req)
        const { id } = await params
        const body = await req.json() as { action?: unknown; participants?: unknown; bookingItems?: unknown }

        if (body.action === 'reschedule') {
            const booking = await prisma.booking.findUnique({
                where: { id },
                include: {
                    bookingItems: { include: { court: true }, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] },
                    payments: true,
                },
            })

            if (!booking) {
                return NextResponse.json({ error: 'ไม่พบข้อมูลการจอง' }, { status: 404 })
            }
            if (booking.userId !== user.id && !['ADMIN', 'SUPERUSER'].includes(user.role)) {
                return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
            }
            if (booking.status !== 'CONFIRMED') {
                return NextResponse.json({ error: 'เปลี่ยนวันเวลาได้เฉพาะการจองที่ยืนยันแล้ว' }, { status: 400 })
            }

            const earliestItem = [...booking.bookingItems].sort((a, b) =>
                `${normalizeDateOnly(a.date)}T${a.startTime}`.localeCompare(`${normalizeDateOnly(b.date)}T${b.startTime}`)
            )[0]
            if (!earliestItem) {
                return NextResponse.json({ error: 'ไม่พบรายการจอง' }, { status: 400 })
            }

            const originalStartAt = toBangkokDateTime(normalizeDateOnly(earliestItem.date), earliestItem.startTime)
            const deadline = originalStartAt.getTime() - RESCHEDULE_MIN_NOTICE_DAYS * 24 * 60 * 60 * 1000
            if (Date.now() > deadline) {
                return NextResponse.json({ error: `ต้องเปลี่ยนก่อนเวลาเดิมอย่างน้อย ${RESCHEDULE_MIN_NOTICE_DAYS} วัน` }, { status: 400 })
            }

            const submittedItems = Array.isArray(body.bookingItems) ? body.bookingItems as RescheduleItemInput[] : []
            if (submittedItems.length !== booking.bookingItems.length) {
                return NextResponse.json({ error: 'รายการเปลี่ยนวันเวลาไม่ครบถ้วน' }, { status: 400 })
            }

            const existingById = new Map(booking.bookingItems.map(item => [item.id, item]))
            const nextItems: Array<{
                id: string
                courtId: string
                date: string
                startTime: string
                endTime: string
                price: number
                teacherId: string | null
                originalCourtId: string
                originalDate: Date
                originalStartTime: string
                originalEndTime: string
            }> = []
            for (const submitted of submittedItems) {
                if (typeof submitted.id !== 'string') {
                    return NextResponse.json({ error: 'รายการจองไม่ถูกต้อง' }, { status: 400 })
                }
                const existing = existingById.get(submitted.id)
                if (!existing) {
                    return NextResponse.json({ error: 'รายการจองไม่ถูกต้อง' }, { status: 400 })
                }

                const date = typeof submitted.date === 'string' ? submitted.date.split('T')[0] : ''
                const startTime = typeof submitted.startTime === 'string' ? submitted.startTime : ''
                const endTime = typeof submitted.endTime === 'string' ? submitted.endTime : ''
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
                    return NextResponse.json({ error: 'วันที่หรือเวลาไม่ถูกต้อง' }, { status: 400 })
                }
                if (!getSlotHourRange({ startTime, endTime })) {
                    return NextResponse.json({ error: 'ช่วงเวลาไม่ถูกต้อง' }, { status: 400 })
                }
                if (toBangkokDateTime(date, startTime).getTime() <= Date.now()) {
                    return NextResponse.json({ error: 'ไม่สามารถเปลี่ยนไปยังเวลาที่ผ่านมาแล้ว' }, { status: 400 })
                }
                if (!await validateCourtOpen(existing.courtId, date, startTime, endTime)) {
                    return NextResponse.json({ error: 'สนามไม่เปิดให้จองในวันเวลาที่เลือก' }, { status: 400 })
                }

                const price = await resolveBookingItemPrice(existing.courtId, date, startTime, endTime)
                nextItems.push({
                    id: existing.id,
                    courtId: existing.courtId,
                    date,
                    startTime,
                    endTime,
                    price,
                    teacherId: existing.teacherId,
                    originalCourtId: existing.originalCourtId || existing.courtId,
                    originalDate: existing.originalDate || existing.date,
                    originalStartTime: existing.originalStartTime || existing.startTime,
                    originalEndTime: existing.originalEndTime || existing.endTime,
                })
            }

            const conflict = await findRescheduleConflict(id, nextItems)
            if (conflict) {
                return NextResponse.json({ error: `ช่วงเวลา ${conflict.date} ${conflict.startTime} ถูกจองแล้ว` }, { status: 409 })
            }

            const beforeItems = booking.bookingItems.map(summarizeBookingItemForAudit)
            const totalAmount = nextItems.reduce((sum, item) => sum + item.price, 0)

            await prisma.$transaction(async tx => {
                await tx.bookingItem.deleteMany({ where: { bookingId: id } })
                await tx.bookingItem.createMany({
                    data: nextItems.map(item => ({
                        bookingId: id,
                        courtId: item.courtId,
                        date: toDateNoonUTC(item.date),
                        startTime: item.startTime,
                        endTime: item.endTime,
                        price: item.price,
                        teacherId: item.teacherId,
                        originalCourtId: item.originalCourtId,
                        originalDate: item.originalDate,
                        originalStartTime: item.originalStartTime,
                        originalEndTime: item.originalEndTime,
                    })),
                })

                await tx.booking.update({
                    where: { id },
                    data: { totalAmount },
                })

                await tx.auditLog.create({
                    data: {
                        userId: user.id,
                        action: 'BOOKING_CUSTOMER_RESCHEDULE',
                        entityType: 'booking',
                        entityId: id,
                        ipAddress: requestMeta.ipAddress,
                        details: JSON.stringify({
                            bookingNumber: booking.bookingNumber,
                            noticeDays: RESCHEDULE_MIN_NOTICE_DAYS,
                            totalAmount: { from: booking.totalAmount, to: totalAmount },
                            bookingItems: {
                                before: beforeItems,
                                after: nextItems.map(item => summarizeBookingItemForAudit({ ...item, court: existingById.get(item.id)?.court })),
                            },
                            request: requestMeta,
                        }),
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

            if (!updated) {
                return NextResponse.json({ error: 'ไม่พบข้อมูลการจอง' }, { status: 404 })
            }

            publishRealtimeEvent({
                type: 'booking_updated',
                bookingId: updated.id,
                bookingNumber: updated.bookingNumber,
                status: updated.status,
                source: 'customer',
                affectedDates: [...new Set([...booking.bookingItems.map(item => normalizeDateOnly(item.date)), ...updated.bookingItems.map(item => normalizeDateOnly(item.date))])],
                courtIds: [...new Set(updated.bookingItems.map(item => item.courtId))],
                message: 'booking customer rescheduled',
            })

            return NextResponse.json({ booking: updated })
        }

        const participantInputs = Array.isArray(body.participants)
            ? body.participants as ParticipantInput[]
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
        const participants = participantInputs.map(participant => ({
            id: typeof participant.id === 'string' ? participant.id : undefined,
            name: typeof participant.name === 'string' ? participant.name.trim() : '',
            sportType: typeof participant.sportType === 'string' ? participant.sportType : undefined,
            age: typeof participant.age === 'number' ? participant.age : (participant.age === null ? null : undefined),
            shoeSize: typeof participant.shoeSize === 'string' ? participant.shoeSize : (participant.shoeSize === null ? null : undefined),
            weight: typeof participant.weight === 'number' ? participant.weight : (participant.weight === null ? null : undefined),
            height: typeof participant.height === 'number' ? participant.height : (participant.height === null ? null : undefined),
            phone: typeof participant.phone === 'string' ? participant.phone : (participant.phone === null ? null : undefined),
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
                    const updateData: Record<string, unknown> = { name: participant.name }
                    if (participant.sportType !== undefined) updateData.sportType = participant.sportType
                    if (participant.age !== undefined) updateData.age = participant.age
                    if (participant.shoeSize !== undefined) updateData.shoeSize = participant.shoeSize
                    if (participant.weight !== undefined) updateData.weight = participant.weight
                    if (participant.height !== undefined) updateData.height = participant.height
                    if (participant.phone !== undefined) updateData.phone = participant.phone
                    await tx.participant.update({
                        where: { id: participant.id },
                        data: updateData,
                    })
                } else {
                    await tx.participant.create({
                        data: {
                            bookingId: id,
                            name: participant.name,
                            sportType: participant.sportType || defaultSportType,
                            age: typeof participant.age === 'number' ? participant.age : null,
                            shoeSize: typeof participant.shoeSize === 'string' ? participant.shoeSize : null,
                            weight: typeof participant.weight === 'number' ? participant.weight : null,
                            height: typeof participant.height === 'number' ? participant.height : null,
                            phone: typeof participant.phone === 'string' ? participant.phone : null,
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
                    ipAddress: requestMeta.ipAddress,
                    details: JSON.stringify({
                        bookingNumber: booking.bookingNumber,
                        participantCount: participants.length,
                        changes: {
                            participants: {
                                before: booking.participants.map(summarizeParticipantForAudit),
                                after: participants.map(participant => summarizeParticipantForAudit({
                                    id: participant.id,
                                    name: participant.name,
                                    sportType: participant.sportType || defaultSportType,
                                    phone: participant.phone || null,
                                    height: typeof participant.height === 'number' ? participant.height : null,
                                    weight: typeof participant.weight === 'number' ? participant.weight : null,
                                    shoeSize: typeof participant.shoeSize === 'string' ? participant.shoeSize : null,
                                    isBooker: booking.participants.find(existing => existing.id === participant.id)?.isBooker || false,
                                })),
                            },
                        },
                        request: requestMeta,
                    }),
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
