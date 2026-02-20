import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDayOfWeek, generateTimeSlots } from '@/lib/utils'

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const dateStr = searchParams.get('date')

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

        // Get all active courts with their operating hours for this day
        const courts = await prisma.court.findMany({
            where: { isActive: true },
            include: {
                operatingHours: {
                    where: { dayOfWeek: dayOfWeek as any },
                },
                pricingRules: {
                    where: {
                        isActive: true,
                        daysOfWeek: { has: dayOfWeek as any },
                    },
                    orderBy: { priority: 'desc' },
                },
            },
            orderBy: { sortOrder: 'asc' },
        })

        // Get existing bookings for this date
        const existingBookings = await prisma.bookingItem.findMany({
            where: {
                date: { equals: date },
                booking: { status: { not: 'CANCELLED' } },
            },
            select: {
                courtId: true,
                startTime: true,
                endTime: true,
            },
        })

        const bookedSlots = new Set(
            existingBookings.map((b) => `${b.courtId}:${b.startTime}`)
        )

        // Build availability data
        const availability = courts.map((court) => {
            const hours = court.operatingHours[0]
            if (!hours || hours.isClosed) {
                return {
                    courtId: court.id,
                    courtName: court.name,
                    closed: true,
                    slots: [],
                }
            }

            const timeSlots = generateTimeSlots(hours.openTime, hours.closeTime)

            const slots = timeSlots.map((time) => {
                const isBooked = bookedSlots.has(`${court.id}:${time}`)

                // Find matching price rule
                let price = 0
                for (const rule of court.pricingRules) {
                    const timeNum = parseInt(time.replace(':', ''))
                    const startNum = parseInt(rule.startTime.replace(':', ''))
                    const endNum = parseInt(rule.endTime.replace(':', ''))

                    if (timeNum >= startNum && timeNum < endNum) {
                        price = rule.price
                        break
                    }
                }

                const endHour = parseInt(time.split(':')[0]) + 1
                const endTime = `${endHour.toString().padStart(2, '0')}:00`

                return {
                    startTime: time,
                    endTime,
                    price,
                    status: isBooked ? 'booked' : 'available',
                }
            })

            return {
                courtId: court.id,
                courtName: court.name,
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
