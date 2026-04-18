import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateTimeSlots } from '@/lib/utils'
import { expandSlotStartTimes, normalizeDateOnly } from '@/lib/booking-slots'

export const dynamic = 'force-dynamic'

// GET availability for a month — returns per-day slot counts for calendar coloring
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())
        const sportType = searchParams.get('sportType') || null
        const venueId = searchParams.get('venueId')

        // Date range for the month
        const monthStr = String(month).padStart(2, '0')
        const lastDay = new Date(year, month, 0).getDate()
        const startDate = new Date(`${year}-${monthStr}-01T00:00:00Z`)
        const endDate = new Date(`${year}-${monthStr}-${String(lastDay).padStart(2, '0')}T23:59:59Z`)

        // Get courts for this sport/venue
        const courtWhere: { isActive: boolean; sportType?: string; venueId?: string } = { isActive: true }
        if (sportType) courtWhere.sportType = sportType
        if (venueId) courtWhere.venueId = venueId

        const courts = await prisma.court.findMany({
            where: courtWhere,
            select: { id: true },
        })
        const courtIds = courts.map(c => c.id)
        if (courtIds.length === 0) return NextResponse.json({ availability: {} })

        // Get operating hours to know total slots per day
        const opHours = await prisma.operatingHours.findMany()

        // Get all booked items in this month
        const bookedItems = await prisma.bookingItem.findMany({
            where: {
                courtId: { in: courtIds },
                date: { gte: startDate, lte: endDate },
                booking: { status: { not: 'CANCELLED' } },
            },
            select: { date: true, startTime: true, endTime: true, courtId: true },
        })

        // Get active locks (SlotLock.date is String)
        const startDateStr = `${year}-${monthStr}-01`
        const endDateStr = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`
        const locks = await prisma.slotLock.findMany({
            where: {
                courtId: { in: courtIds },
                date: { gte: startDateStr, lte: endDateStr },
                expiresAt: { gt: new Date() },
            },
            select: { date: true, startTime: true, courtId: true },
        })

        // Get closed dates
        const closedDates = await prisma.closedDate.findMany({
            where: { date: { gte: startDate, lte: endDate } },
            select: { date: true },
        }).catch(() => [] as Array<{ date: Date }>)

        const closedSet = new Set(closedDates.map(d => normalizeDateOnly(d.date)))

        // Calculate availability per day
        const availability: Record<string, { totalSlots: number; bookedSlots: number; status: 'available' | 'almost_full' | 'full' | 'closed' | 'past' }> = {}

        // Use Bangkok timezone for today comparison
        const nowBkk = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
        const todayBkk = new Date(nowBkk.getFullYear(), nowBkk.getMonth(), nowBkk.getDate())

        // Group opHours by courtId for per-court slot calculation
        const opHoursByCourtId: Record<string, typeof opHours> = {}
        opHours.forEach(o => {
            if (!opHoursByCourtId[o.courtId]) opHoursByCourtId[o.courtId] = []
            opHoursByCourtId[o.courtId].push(o)
        })

        for (let d = 1; d <= lastDay; d++) {
            const date = new Date(year, month - 1, d)
            const dateStr = `${year}-${monthStr}-${String(d).padStart(2, '0')}`

            if (date < todayBkk) {
                availability[dateStr] = { totalSlots: 0, bookedSlots: 0, status: 'past' }
                continue
            }

            if (closedSet.has(dateStr)) {
                availability[dateStr] = { totalSlots: 0, bookedSlots: 0, status: 'closed' }
                continue
            }

            // Find operating hours for this day — per court
            const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
            const dayOfWeek = dayNames[date.getDay()]

            let totalSlots = 0
            for (const cid of courtIds) {
                const courtOp = opHoursByCourtId[cid]?.find(o => o.dayOfWeek === dayOfWeek)
                if (!courtOp || courtOp.isClosed) continue
                totalSlots += generateTimeSlots(courtOp.openTime, courtOp.closeTime).length
            }

            if (totalSlots === 0) {
                availability[dateStr] = { totalSlots: 0, bookedSlots: 0, status: 'closed' }
                continue
            }

            // Count booked + locked slots
            const bookedCount = bookedItems
                .filter(b => normalizeDateOnly(b.date) === dateStr)
                .reduce((sum, item) => sum + expandSlotStartTimes(item).length, 0)

            const lockedCount = locks.filter(l => l.date === dateStr).length

            const usedSlots = bookedCount + lockedCount
            const pct = totalSlots > 0 ? usedSlots / totalSlots : 0

            let status: 'available' | 'almost_full' | 'full' = 'available'
            if (pct >= 1) status = 'full'
            else if (pct >= 0.7) status = 'almost_full'

            availability[dateStr] = { totalSlots, bookedSlots: usedSlots, status }
        }

        return NextResponse.json({ availability }, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
            },
        })
    } catch (error) {
        console.error('Calendar availability error:', error)
        return NextResponse.json({ availability: {} })
    }
}
