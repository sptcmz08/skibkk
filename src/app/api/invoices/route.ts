import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — load saved invoice data for a booking
export async function GET(req: NextRequest) {
    try {
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const bookingId = req.nextUrl.searchParams.get('bookingId')
        if (!bookingId) {
            return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payments: { select: { method: true } } },
        })

        if (!booking) {
            return NextResponse.json({ error: 'ไม่พบรายการจอง' }, { status: 404 })
        }

        const isPackageBooking = booking.payments.some(payment => payment.method === 'PACKAGE') || booking.totalAmount <= 0
        if (isPackageBooking) {
            return NextResponse.json({ invoice: null })
        }

        const invoice = await prisma.invoice.findUnique({
            where: { bookingId },
        })

        return NextResponse.json({ invoice })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('Invoice GET error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// POST — save/update invoice data
export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const body = await req.json()
        const { bookingId, invoiceNumber, totalAmount, vatAmount, grandTotal, customData, isIssued } = body

        if (!bookingId || !invoiceNumber) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payments: { select: { method: true } } },
        })

        if (!booking) {
            return NextResponse.json({ error: 'ไม่พบรายการจอง' }, { status: 404 })
        }

        const isPackageBooking = booking.payments.some(payment => payment.method === 'PACKAGE') || booking.totalAmount <= 0
        if (isPackageBooking) {
            return NextResponse.json({ error: 'รายการจองที่ใช้แพ็คเกจไม่ต้องออกเลข INV' }, { status: 400 })
        }

        const issuedFlag = typeof isIssued === 'boolean' ? isIssued : false
        const createData = {
            bookingId,
            invoiceNumber,
            totalAmount,
            vatAmount,
            grandTotal,
            customData,
            isIssued: issuedFlag,
            issuedAt: issuedFlag ? new Date() : undefined,
        }
        const updateData = {
            invoiceNumber,
            totalAmount,
            vatAmount,
            grandTotal,
            customData,
            isIssued: issuedFlag,
            ...(issuedFlag ? { issuedAt: new Date() } : {}),
        }

        const invoice = await prisma.invoice.upsert({
            where: { bookingId },
            create: createData,
            update: updateData,
        })

        return NextResponse.json({ invoice })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('Invoice POST error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
