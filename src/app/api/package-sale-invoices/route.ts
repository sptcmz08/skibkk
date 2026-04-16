import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { parsePackageSaleAuditDetails } from '@/lib/package-sale-invoice'

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

export async function GET(req: NextRequest) {
    try {
        await requireInvoiceAccess()

        const logId = req.nextUrl.searchParams.get('logId')
        if (!logId) {
            return NextResponse.json({ error: 'logId is required' }, { status: 400 })
        }

        const saleLog = await loadPackageSaleLog(logId)
        if (!saleLog) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลการขายแพ็คเกจ' }, { status: 404 })
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
        await requireInvoiceAccess()

        const body = await req.json()
        const {
            logId,
            invoiceNumber,
            totalAmount,
            vatAmount,
            grandTotal,
            customData,
            isIssued,
        } = body as {
            logId?: string
            invoiceNumber?: string
            totalAmount?: number
            vatAmount?: number
            grandTotal?: number
            customData?: Record<string, unknown>
            isIssued?: boolean
        }

        if (!logId || !invoiceNumber) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const saleLog = await loadPackageSaleLog(logId)
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
            if (log.id === logId) return false
            const details = parsePackageSaleAuditDetails(log.details)
            return details.invoice?.invoiceNumber === invoiceNumber
        })
        if (duplicatePackageSaleInvoice) {
            return NextResponse.json({ error: 'เลขที่ใบกำกับนี้ถูกใช้งานแล้ว' }, { status: 409 })
        }

        const details = parsePackageSaleAuditDetails(saleLog.details)
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

        return NextResponse.json({ invoice: details.invoice })
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
