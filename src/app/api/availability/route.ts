import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDayOfWeek, generateTimeSlots } from '@/lib/utils'

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const dateStr = searchParams.get('date')
        const sessionId = searchParams.get('sessionId') || ''

        if (!dateStr) {
            return NextResponse.json({ error: 'กรุณาระบุวันที่' }, { status: 400 })
        }

        const date = new Date(dateStr)
        const dayOfWeek = getDayOfWeek(date)

        // Check special closed dates
        const specialClosed = await prisma.specialClosedDate.findFirst({
            where: { date: { equals: date } },
        })
        if (specialClosed) {
            return NextResponse.json({
                closed: true,
                reason: specialClosed.reason || 'วันหยุดพิเศษ',
                slots: [],
            })
        }

        // Get all active courts
        const courts = await prisma.court.findMany({
            where: { isActive: true },
            include: {
                operatingHours: { where: { dayOfWeek: dayOfWeek as any } },
                pricingRules: {
                    where: { isActive: true, daysOfWeek: { has: dayOfWeek as any } },
                    orderBy: { priority: 'desc' },
                },
            },
            orderBy: { sortOrder: 'asc' },
        })

        // Get existing bookings
        const existingBookings = await prisma.bookingItem.findMany({
            where: {
                date: { equals: date },
                booking: { status: { not: 'CANCELLED' } },
            },
            select: { courtId: true, startTime: true },
        })
        const bookedSlots = new Set(existingBookings.map((b) => `${b.courtId}:${b.startTime}`))

        // Get active slot locks for this date
        const now = new Date()
        const slotLocks = await prisma.slotLock.findMany({
            where: { date: dateStr, expiresAt: { gt: now } },
        })
        // Map: "courtId:startTime" => lock record
        const lockMap = new Map(slotLocks.map(l => [`${l.courtId}:${l.startTime}`, l]))

        // Build availability data
        const availability = courts.map((court) => {
            const hours = court.operatingHours[0]
            if (!hours || hours.isClosed) {
                return { courtId: court.id, courtName: court.name, sportType: court.sportType ?? null, closed: true, slots: [] }
            }

            const timeSlots = generateTimeSlots(hours.openTime, hours.closeTime)

            const slots = timeSlots.map((time) => {
                const isBooked = bookedSlots.has(`${court.id}:${time}`)
                const lock = lockMap.get(`${court.id}:${time}`)
                const isLockedByMe = lock?.sessionId === sessionId
                const isLockedByOther = lock && lock.sessionId !== sessionId

                let price = 0
                for (const rule of court.pricingRules) {
                    const timeNum = parseInt(time.replace(':', ''))
                    const startNum = parseInt(rule.startTime.replace(':', ''))
                    const endNum = parseInt(rule.endTime.replace(':', ''))
                    if (timeNum >= startNum && timeNum < endNum) { price = rule.price; break }
                }

                const endHour = parseInt(time.split(':')[0]) + 1
                const endTime = `${endHour.toString().padStart(2, '0')}:00`

                const secondsLeft = isLockedByOther
                    ? Math.max(0, Math.ceil((lock!.expiresAt.getTime() - now.getTime()) / 1000))
                    : 0

                return {
                    startTime: time,
                    endTime,
                    price,
                    available: !isBooked && !isLockedByOther,
                    status: isBooked ? 'booked' : isLockedByMe ? 'mine' : isLockedByOther ? 'locked' : 'available',
                    lockedByMe: isLockedByMe,
                    lockedByOther: !!isLockedByOther,
                    lockedUntil: isLockedByOther ? lock!.expiresAt : null,
                    secondsLeft,
                }
            })

            return {
                courtId: court.id,
                courtName: court.name,
                sportType: court.sportType ?? null,
                closed: false,
                slots,
            }
        })

        return NextResponse.json({ availability, date: dateStr })
    } catch (error) {
        console.error('Availability GET error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
