import { NextRequest, NextResponse } from 'next/server'
import type { DayOfWeek, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getDayOfWeek, generateTimeSlots, resolveSlotPrice } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const dateStr = searchParams.get('date')
        const sessionId = searchParams.get('sessionId') || ''
        const venueId = searchParams.get('venueId')

        if (!dateStr) {
            return NextResponse.json({ error: 'กรุณาระบุวันที่' }, { status: 400 })
        }

        const [year, month, day] = dateStr.split('-').map(Number)
        if (!year || !month || !day) {
            return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 })
        }

        const selectedDate = new Date(`${dateStr}T12:00:00Z`)
        const startOfDay = new Date(`${dateStr}T00:00:00Z`)
        const endOfDay = new Date(`${dateStr}T23:59:59Z`)
        const dayOfWeek = getDayOfWeek(selectedDate) as DayOfWeek

        // Check special closed dates
        const specialClosed = await prisma.specialClosedDate.findFirst({
            where: { date: { gte: startOfDay, lte: endOfDay } },
        })
        if (specialClosed) {
            return NextResponse.json({
                closed: true,
                reason: specialClosed.reason || 'วันหยุดพิเศษ',
                slots: [],
            })
        }

        // Get visible courts, filtered by venue if specified
        const courtWhere: Prisma.CourtWhereInput = { status: { in: ['ACTIVE', 'CLOSED'] } }
        if (venueId) courtWhere.venueId = venueId

        const courts = await prisma.court.findMany({
            where: courtWhere,
            include: {
                operatingHours: { where: { dayOfWeek } },
                pricingRules: {
                    where: { isActive: true, daysOfWeek: { has: dayOfWeek } },
                    orderBy: { priority: 'desc' },
                },
            },
            orderBy: { sortOrder: 'asc' },
        })

        // Get global pricing rules (courtId is null = applies to ALL courts)
        const globalPricingRules = await prisma.pricingRule.findMany({
            where: { isActive: true, courtId: null, daysOfWeek: { has: dayOfWeek } },
            orderBy: { priority: 'desc' },
        })

        // Get existing bookings
        const existingBookings = await prisma.bookingItem.findMany({
            where: {
                date: { gte: startOfDay, lte: endOfDay },
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
            // CLOSED courts: show but all slots unavailable
            if (court.status === 'CLOSED') {
                return { courtId: court.id, courtName: court.name, sportType: court.sportType ?? null, status: 'CLOSED', closed: true, closedReason: 'สนามปิดปรับปรุง', slots: [] }
            }

            const hours = court.operatingHours[0]
            if (!hours || hours.isClosed) {
                return { courtId: court.id, courtName: court.name, sportType: court.sportType ?? null, status: court.status, closed: true, slots: [] }
            }

            const timeSlots = generateTimeSlots(hours.openTime, hours.closeTime)

            // Check if the requested date is today (Bangkok time)
            const nowBkk = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
            const todayBkk = `${nowBkk.getFullYear()}-${String(nowBkk.getMonth() + 1).padStart(2, '0')}-${String(nowBkk.getDate()).padStart(2, '0')}`
            const isToday = dateStr === todayBkk
            const currentHour = nowBkk.getHours()
            const currentMinute = nowBkk.getMinutes()

            // Merge court-specific rules (higher priority) with global rules
            const allRules = [...court.pricingRules, ...globalPricingRules]
                .sort((a, b) => b.priority - a.priority)

            const slots = timeSlots.map((time) => {
                const isBooked = bookedSlots.has(`${court.id}:${time}`)
                const lock = lockMap.get(`${court.id}:${time}`)
                const isLockedByMe = lock?.sessionId === sessionId
                const isLockedByOther = lock && lock.sessionId !== sessionId

                // Check if this slot's start time has already passed (Bangkok time)
                const [slotH, slotM] = time.split(':').map(Number)
                const isPast = isToday && (slotH < currentHour || (slotH === currentHour && slotM <= currentMinute))

                const price = resolveSlotPrice(time, allRules)

                const endHour = parseInt(time.split(':')[0]) + 1
                const endTime = `${endHour.toString().padStart(2, '0')}:00`

                const secondsLeft = isLockedByOther
                    ? Math.max(0, Math.ceil((lock!.expiresAt.getTime() - now.getTime()) / 1000))
                    : 0

                return {
                    startTime: time,
                    endTime,
                    price,
                    available: !isBooked && !isLockedByOther && !isPast,
                    isPast,
                    status: isPast ? 'past' : isBooked ? 'booked' : isLockedByMe ? 'mine' : isLockedByOther ? 'locked' : 'available',
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
                status: court.status,
                closed: false,
                slots,
            }
        })

        return NextResponse.json({ availability, date: dateStr }, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
            },
        })
    } catch (error) {
        console.error('Availability GET error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
