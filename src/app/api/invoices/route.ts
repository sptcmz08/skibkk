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
        const { bookingId, invoiceNumber, totalAmount, vatAmount, grandTotal, customData } = body

        if (!bookingId || !invoiceNumber) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const createData = { bookingId, invoiceNumber, totalAmount, vatAmount, grandTotal, customData }
        const updateData = { invoiceNumber, totalAmount, vatAmount, grandTotal, customData }

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
