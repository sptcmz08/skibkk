import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import {
    parsePackageSaleAuditDetails,
    type PackageSaleAuditDetails,
} from '@/lib/package-sale-invoice'
import { generateNextPackageSaleNumber } from '@/lib/document-number-service'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['ADMIN', 'SUPERUSER', 'STAFF']

const requireInvoiceAccess = async () => {
    const user = await requireAuth()
    if (!ALLOWED_ROLES.includes(user.role)) {
        throw new Error('FORBIDDEN')
    }
    return user
}

const loadPackageSaleLog = async (logId: string) => {
    return prisma.auditLog.findFirst({
        where: {
            id: logId,
            action: 'PACKAGE_ASSIGN',
            entityType: 'user_package',
        },
    })
}

const loadPackageSaleLogByUserPackageId = async (userPackageId: string) => {
    return prisma.auditLog.findFirst({
        where: {
            entityId: userPackageId,
            action: 'PACKAGE_ASSIGN',
            entityType: 'user_package',
        },
    })
}

const buildPackageSaleDetails = (userPackage: {
    id: string
    purchasedAt: Date
    expiresAt: Date
    user: { id: string; name: string; email: string; phone: string }
    package: { id: string; name: string; totalHours: number; price: number; validDays: number }
}, saleNumber: string): PackageSaleAuditDetails => ({
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

const loadUserPackageForInvoice = async (userPackageId: string) => {
    return prisma.userPackage.findUnique({
        where: { id: userPackageId },
        include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            package: { select: { id: true, name: true, totalHours: true, price: true, validDays: true } },
        },
    })
}

export async function GET(req: NextRequest) {
    try {
        await requireInvoiceAccess()

        const logId = req.nextUrl.searchParams.get('logId')
        const userPackageId = req.nextUrl.searchParams.get('userPackageId')
        if (!logId && !userPackageId) {
            return NextResponse.json({ error: 'logId or userPackageId is required' }, { status: 400 })
        }

        const saleLog = logId
            ? await loadPackageSaleLog(logId)
            : userPackageId
                ? await loadPackageSaleLogByUserPackageId(userPackageId)
                : null
        if (!saleLog) {
            return NextResponse.json({ invoice: null })
        }

        const details = parsePackageSaleAuditDetails(saleLog.details)
        return NextResponse.json({ invoice: details.invoice || null })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        if ((error as Error).message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }
        console.error('Package sale invoice GET error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await requireInvoiceAccess()

        const body = await req.json()
        const {
            logId,
            userPackageId,
            saleNumber,
            invoiceNumber,
            totalAmount,
            vatAmount,
            grandTotal,
            customData,
            isIssued,
        } = body as {
            logId?: string
            userPackageId?: string
            saleNumber?: string
            invoiceNumber?: string
            totalAmount?: number
            vatAmount?: number
            grandTotal?: number
            customData?: Record<string, unknown>
            isIssued?: boolean
        }

        if ((!logId && !userPackageId) || !invoiceNumber) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        let saleLog = logId
            ? await loadPackageSaleLog(logId)
            : userPackageId
                ? await loadPackageSaleLogByUserPackageId(userPackageId)
                : null
        if (logId && !saleLog) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลการขายแพ็คเกจ' }, { status: 404 })
        }
        let seedDetails: PackageSaleAuditDetails | null = null
        if (!saleLog && userPackageId) {
            const userPackage = await loadUserPackageForInvoice(userPackageId)
            if (!userPackage) {
                return NextResponse.json({ error: 'ไม่พบข้อมูลแพ็คเกจลูกค้า' }, { status: 404 })
            }
            const requestedSaleNumber = typeof saleNumber === 'string' && /^PKG-\d{10}$/.test(saleNumber)
                ? saleNumber
                : null
            seedDetails = buildPackageSaleDetails(userPackage, requestedSaleNumber || await generateNextPackageSaleNumber())
            saleLog = await prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'PACKAGE_ASSIGN',
                    entityType: 'user_package',
                    entityId: userPackage.id,
                    details: JSON.stringify(seedDetails),
                },
            })
        }
        if (!saleLog) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลการขายแพ็คเกจ' }, { status: 404 })
        }

        const duplicateBookingInvoice = await prisma.invoice.findUnique({
            where: { invoiceNumber },
            select: { id: true },
        })
        if (duplicateBookingInvoice) {
            return NextResponse.json({ error: 'เลขที่ใบกำกับนี้ถูกใช้งานแล้ว' }, { status: 409 })
        }

        const saleLogs = await prisma.auditLog.findMany({
            where: {
                action: 'PACKAGE_ASSIGN',
                entityType: 'user_package',
            },
            select: {
                id: true,
                details: true,
            },
        })
        const duplicatePackageSaleInvoice = saleLogs.some(log => {
            if (saleLog && log.id === saleLog.id) return false
            const details = parsePackageSaleAuditDetails(log.details)
            return details.invoice?.invoiceNumber === invoiceNumber
        })
        if (duplicatePackageSaleInvoice) {
            return NextResponse.json({ error: 'เลขที่ใบกำกับนี้ถูกใช้งานแล้ว' }, { status: 409 })
        }

        const details = seedDetails || parsePackageSaleAuditDetails(saleLog.details)
        const currentInvoice = details.invoice || null
        const issuedFlag = typeof isIssued === 'boolean' ? isIssued : false
        const nowIso = new Date().toISOString()

        details.invoice = {
            invoiceNumber,
            totalAmount: Number(totalAmount || 0),
            vatAmount: Number(vatAmount || 0),
            grandTotal: Number(grandTotal || 0),
            customData: customData || {},
            isIssued: issuedFlag,
            issuedAt: issuedFlag ? (currentInvoice?.issuedAt || nowIso) : currentInvoice?.issuedAt || null,
            updatedAt: nowIso,
        }

        await prisma.auditLog.update({
            where: { id: saleLog.id },
            data: { details: JSON.stringify(details) },
        })

        return NextResponse.json({ invoice: details.invoice, logId: saleLog.id })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        if ((error as Error).message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }
        console.error('Package sale invoice POST error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
