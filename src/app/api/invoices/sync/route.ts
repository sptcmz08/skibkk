import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import {
    formatInvoiceNumberFromYearMonthSequence,
    getInvoiceYearMonth,
} from '@/lib/document-number-format'
import {
    formatPackageSaleNumberFromDateSequence,
    parsePackageSaleAuditDetails,
    type PackageSaleAuditDetails,
} from '@/lib/package-sale-invoice'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = new Set(['ADMIN', 'SUPERUSER', 'STAFF'])

type BookingInvoiceSource = {
    id: string
    bookingNumber: string
    totalAmount: number
    createdAt: Date
    invoice: {
        id: string
        customData: unknown
        isIssued: boolean
    } | null
}

type PackageInvoiceSource = {
    id: string
    purchasedAt: Date
    expiresAt: Date
    user: { id: string; name: string; email: string; phone: string }
    package: { id: string; name: string; totalHours: number; price: number; validDays: number }
}

type InvoiceSyncRow =
    | { type: 'booking'; key: string; sortDate: Date; sourceNumber: string; booking: BookingInvoiceSource }
    | { type: 'package'; key: string; sortDate: Date; sourceNumber: string; userPackage: PackageInvoiceSource; saleLogId: string; details: PackageSaleAuditDetails }

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const roundMoney = (amount: number) => Math.round(amount * 100) / 100

const getSourceSequence = (sourceNumber: string) => {
    const match = sourceNumber.match(/\d{6}(\d{5})$/)
    return match ? Number(match[1]) : 0
}

const buildPackageSaleDetails = (userPackage: PackageInvoiceSource, saleNumber: string): PackageSaleAuditDetails => ({
    saleNumber,
    customer: {
        id: userPackage.user.id,
        name: userPackage.user.name,
        email: userPackage.user.email,
        phone: userPackage.user.phone,
    },
    package: {
        id: userPackage.package.id,
        name: userPackage.package.name,
        totalHours: userPackage.package.totalHours,
        price: userPackage.package.price,
        validDays: userPackage.package.validDays,
    },
    purchasedAt: userPackage.purchasedAt.toISOString(),
    expiresAt: userPackage.expiresAt.toISOString(),
})

const buildSaleNumberMap = (
    bookings: Array<{ bookingNumber: string }>,
    saleLogs: Array<{ details: string | null }>,
    userPackages: PackageInvoiceSource[]
) => {
    const sequenceByMonth = new Map<string, number>()
    const saleNumberByUserPackageId = new Map<string, string>()

    for (const booking of bookings) {
        const match = booking.bookingNumber.match(/^BK(\d{6})(\d{5})$/)
        if (!match) continue
        sequenceByMonth.set(match[1], Math.max(sequenceByMonth.get(match[1]) || 0, Number(match[2])))
    }

    for (const log of saleLogs) {
        const details = parsePackageSaleAuditDetails(log.details)
        const modernMatch = details.saleNumber?.match(/^PKG(\d{6})(\d{5})$/)
        if (!modernMatch) continue
        sequenceByMonth.set(modernMatch[1], Math.max(sequenceByMonth.get(modernMatch[1]) || 0, Number(modernMatch[2])))
    }

    for (const userPackage of [...userPackages].sort((a, b) => a.purchasedAt.getTime() - b.purchasedAt.getTime())) {
        const monthKey = getInvoiceYearMonth(userPackage.purchasedAt)
        const nextSequence = (sequenceByMonth.get(monthKey) || 0) + 1
        sequenceByMonth.set(monthKey, nextSequence)
        saleNumberByUserPackageId.set(userPackage.id, formatPackageSaleNumberFromDateSequence(userPackage.purchasedAt, nextSequence))
    }

    return saleNumberByUserPackageId
}

const buildInvoiceNumberMap = (rows: InvoiceSyncRow[]) => {
    const counters = new Map<string, number>()
    const invoiceNumberByKey = new Map<string, string>()

    const chronologicalRows = [...rows].sort((a, b) => {
        const dateDiff = a.sortDate.getTime() - b.sortDate.getTime()
        if (dateDiff !== 0) return dateDiff
        return getSourceSequence(a.sourceNumber) - getSourceSequence(b.sourceNumber)
    })

    for (const row of chronologicalRows) {
        const yearMonth = getInvoiceYearMonth(row.sortDate)
        const nextSequence = (counters.get(yearMonth) || 0) + 1
        counters.set(yearMonth, nextSequence)
        invoiceNumberByKey.set(row.key, formatInvoiceNumberFromYearMonthSequence(yearMonth, nextSequence))
    }

    return invoiceNumberByKey
}

const withInvoiceNo = (customData: unknown, invoiceNumber: string): Record<string, unknown> | undefined => {
    if (!isRecord(customData)) return undefined
    return { ...customData, invoiceNo: invoiceNumber }
}

export async function POST() {
    try {
        const user = await requireAuth()
        if (!ALLOWED_ROLES.has(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const [bookings, allBookingNumbers, saleLogs, userPackages] = await Promise.all([
            prisma.booking.findMany({
                where: {
                    status: { not: 'CANCELLED' },
                    totalAmount: { gt: 0 },
                    payments: { none: { method: 'PACKAGE' } },
                },
                select: {
                    id: true,
                    bookingNumber: true,
                    totalAmount: true,
                    createdAt: true,
                    invoice: { select: { id: true, customData: true, isIssued: true } },
                },
            }),
            prisma.booking.findMany({
                select: { bookingNumber: true },
            }),
            prisma.auditLog.findMany({
                where: {
                    action: 'PACKAGE_ASSIGN',
                    entityType: 'user_package',
                },
                select: {
                    id: true,
                    entityId: true,
                    details: true,
                },
            }),
            prisma.userPackage.findMany({
                include: {
                    user: { select: { id: true, name: true, email: true, phone: true } },
                    package: { select: { id: true, name: true, totalHours: true, price: true, validDays: true } },
                },
            }),
        ])

        await prisma.invoice.deleteMany({
            where: {
                booking: {
                    OR: [
                        { totalAmount: { lte: 0 } },
                        { payments: { some: { method: 'PACKAGE' } } },
                    ],
                },
            },
        })

        const saleLogByUserPackageId = new Map(
            saleLogs
                .map(log => [log.entityId, log])
                .filter((entry): entry is [string, typeof saleLogs[number]] => Boolean(entry[0]))
        )
        const missingSalePackages = userPackages.filter(userPackage => !saleLogByUserPackageId.has(userPackage.id))
        const fallbackSaleNumbers = buildSaleNumberMap(allBookingNumbers, saleLogs, missingSalePackages)

        const packageRows: InvoiceSyncRow[] = []
        for (const userPackage of userPackages) {
            let saleLog = saleLogByUserPackageId.get(userPackage.id)
            let details = parsePackageSaleAuditDetails(saleLog?.details)
            const saleNumber = details.saleNumber && /^PKG\d{11}$/.test(details.saleNumber)
                ? details.saleNumber
                : fallbackSaleNumbers.get(userPackage.id) || formatPackageSaleNumberFromDateSequence(userPackage.purchasedAt, 1)

            if (!saleLog) {
                details = buildPackageSaleDetails(userPackage, saleNumber)
                saleLog = await prisma.auditLog.create({
                    data: {
                        userId: user.id,
                        action: 'PACKAGE_ASSIGN',
                        entityType: 'user_package',
                        entityId: userPackage.id,
                        details: JSON.stringify(details),
                    },
                    select: {
                        id: true,
                        entityId: true,
                        details: true,
                    },
                })
            } else if (!details.saleNumber || !/^PKG\d{11}$/.test(details.saleNumber)) {
                details = { ...details, ...buildPackageSaleDetails(userPackage, saleNumber), invoice: details.invoice || null }
            }

            packageRows.push({
                type: 'package',
                key: `package:${userPackage.id}`,
                sortDate: userPackage.purchasedAt,
                sourceNumber: saleNumber,
                userPackage,
                saleLogId: saleLog.id,
                details,
            })
        }

        const rows: InvoiceSyncRow[] = [
            ...bookings.map(booking => ({
                type: 'booking' as const,
                key: `booking:${booking.id}`,
                sortDate: booking.createdAt,
                sourceNumber: booking.bookingNumber,
                booking,
            })),
            ...packageRows,
        ]
        const invoiceNumberByKey = buildInvoiceNumberMap(rows)
        const now = new Date()
        const nowIso = now.toISOString()

        const existingBookingInvoices = bookings.filter(booking => booking.invoice)
        for (const booking of existingBookingInvoices) {
            await prisma.invoice.update({
                where: { id: booking.invoice!.id },
                data: { invoiceNumber: `SYNC-${booking.invoice!.id}-${now.getTime()}` },
            })
        }

        let bookingInvoicesSynced = 0
        let packageInvoicesSynced = 0

        for (const row of rows) {
            const invoiceNumber = invoiceNumberByKey.get(row.key)
            if (!invoiceNumber) continue

            if (row.type === 'booking') {
                const grandTotal = Number(row.booking.totalAmount || 0)
                const totalAmount = roundMoney(grandTotal / 1.07)
                const vatAmount = roundMoney(grandTotal - totalAmount)
                const bookingCustomData = withInvoiceNo(row.booking.invoice?.customData, invoiceNumber)
                await prisma.invoice.upsert({
                    where: { bookingId: row.booking.id },
                    create: {
                        bookingId: row.booking.id,
                        invoiceNumber,
                        totalAmount,
                        vatAmount,
                        grandTotal,
                        isIssued: false,
                    },
                    update: {
                        invoiceNumber,
                        totalAmount,
                        vatAmount,
                        grandTotal,
                        ...(bookingCustomData ? { customData: bookingCustomData as Prisma.InputJsonObject } : {}),
                    },
                })
                bookingInvoicesSynced += 1
            } else {
                const grandTotal = Number(row.userPackage.package.price || 0)
                const totalAmount = roundMoney(grandTotal / 1.07)
                const vatAmount = roundMoney(grandTotal - totalAmount)
                const currentInvoice = row.details.invoice || null
                const packageCustomData = withInvoiceNo(currentInvoice?.customData, invoiceNumber) || currentInvoice?.customData || {}
                row.details.invoice = {
                    invoiceNumber,
                    totalAmount,
                    vatAmount,
                    grandTotal,
                    customData: packageCustomData,
                    isIssued: Boolean(currentInvoice?.isIssued),
                    issuedAt: currentInvoice?.issuedAt || null,
                    updatedAt: nowIso,
                }
                await prisma.auditLog.update({
                    where: { id: row.saleLogId },
                    data: { details: JSON.stringify(row.details) },
                })
                packageInvoicesSynced += 1
            }
        }

        return NextResponse.json({
            success: true,
            bookingInvoicesSynced,
            packageInvoicesSynced,
            packageBookingInvoicesRemoved: true,
        })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('Invoice sync error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
