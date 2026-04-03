import { prisma } from '@/lib/prisma'

function getBangkokNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
}

function getBangkokYearMonth(date = getBangkokNow()) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}${month}`
}

export async function generateNextBookingNumber() {
    const yearMonth = getBangkokYearMonth()
    const prefix = `BK${yearMonth}`
    const pattern = new RegExp(`^${prefix}(\\d{5})$`)

    const existing = await prisma.booking.findMany({
        where: { bookingNumber: { startsWith: prefix } },
        select: { bookingNumber: true },
    })

    let maxSequence = 0
    for (const booking of existing) {
        const match = booking.bookingNumber.match(pattern)
        if (!match) continue
        maxSequence = Math.max(maxSequence, parseInt(match[1], 10))
    }

    return `${prefix}${String(maxSequence + 1).padStart(5, '0')}`
}
