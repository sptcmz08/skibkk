import type { DayOfWeek } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { expandSlotStartTimes } from '@/lib/booking-slots'
import { getDayOfWeek, resolveSlotPrice } from '@/lib/utils'

const toDateNoonUTC = (dateStr: string) => new Date(`${dateStr.split('T')[0]}T12:00:00Z`)

export async function resolveBookingSlotPrice(courtId: string, date: string, startTime: string, endTime: string) {
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
