import { prisma } from '@/lib/prisma'

function getBangkokNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
}

function getBangkokYearMonth(date = getBangkokNow()) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}${month}`
}

async function getMaxDocumentSequence(yearMonth: string) {
    const bookingPrefix = `BK${yearMonth}`
    const packagePrefix = `PKG${yearMonth}`
    const bookingPattern = new RegExp(`^${bookingPrefix}(\\d{5})$`)
    const packagePattern = new RegExp(`^${packagePrefix}(\\d{5})$`)

    const [bookings, packageLogs] = await Promise.all([
        prisma.booking.findMany({
            where: { bookingNumber: { startsWith: bookingPrefix } },
            select: { bookingNumber: true },
        }),
        prisma.auditLog.findMany({
            where: {
                action: 'PACKAGE_ASSIGN',
                entityType: 'user_package',
                details: { contains: packagePrefix },
            },
            select: { details: true },
        }),
    ])

    let maxSequence = 0
    for (const booking of bookings) {
        const match = booking.bookingNumber.match(bookingPattern)
        if (!match) continue
        maxSequence = Math.max(maxSequence, parseInt(match[1], 10))
    }

    for (const log of packageLogs) {
        let saleNumber = ''
        try {
            const details = JSON.parse(log.details || '{}') as { saleNumber?: string }
            saleNumber = details.saleNumber || ''
        } catch {
            continue
        }
        const match = saleNumber.match(packagePattern)
        if (!match) continue
        maxSequence = Math.max(maxSequence, parseInt(match[1], 10))
    }

    return maxSequence
}

export async function generateNextBookingNumber() {
    const yearMonth = getBangkokYearMonth()
    const prefix = `BK${yearMonth}`
    const maxSequence = await getMaxDocumentSequence(yearMonth)

    return `${prefix}${String(maxSequence + 1).padStart(5, '0')}`
}

export async function generateNextPackageSaleNumber() {
    const yearMonth = getBangkokYearMonth()
    const prefix = `PKG${yearMonth}`
    const maxSequence = await getMaxDocumentSequence(yearMonth)

    return `${prefix}${String(maxSequence + 1).padStart(5, '0')}`
}
