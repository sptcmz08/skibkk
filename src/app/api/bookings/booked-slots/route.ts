import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { expandSlotStartTimes, normalizeDateOnly } from '@/lib/booking-slots'

export const dynamic = 'force-dynamic'

// GET /api/bookings/booked-slots?courtId=xxx&dates=2026-02-27&dates=2026-02-28
// Returns already-booked time slots for a specific court on given dates
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const courtId = searchParams.get('courtId')
        const dates = searchParams.getAll('dates')

        if (!courtId || dates.length === 0) {
            return NextResponse.json({ bookedSlots: [] })
        }

        // Find all non-cancelled booking items for this court on these dates
        const items = await prisma.bookingItem.findMany({
            where: {
                courtId,
                OR: dates.map(date => ({
                    date: {
                        gte: new Date(`${date}T00:00:00Z`),
                        lte: new Date(`${date}T23:59:59Z`),
                    },
                })),
                booking: { status: { not: 'CANCELLED' } },
            },
            select: {
                date: true,
                startTime: true,
                endTime: true,
            },
        })

        // Format response
        const bookedSlots = items.flatMap(item =>
            expandSlotStartTimes(item).map(startTime => ({
                date: normalizeDateOnly(item.date),
                startTime,
            }))
        )

        return NextResponse.json({ bookedSlots }, {
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        })
    } catch (error) {
        console.error('GET /api/bookings/booked-slots error:', error)
        return NextResponse.json({ bookedSlots: [] })
    }
}
