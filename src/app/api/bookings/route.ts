import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requireAuth } from '@/lib/auth'
import { generateBookingNumber } from '@/lib/utils'
import { sendBookingConfirmation } from '@/lib/mailer'

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        const { searchParams } = new URL(req.url)

        // Admin can see all bookings, customers only their own
        if (user && ['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            const date = searchParams.get('date')
            const status = searchParams.get('status')
            const search = searchParams.get('search')

            const where: Record<string, unknown> = {}
            if (status) where.status = status
            if (search) {
                where.OR = [
                    { user: { name: { contains: search, mode: 'insensitive' } } },
                    { user: { phone: { contains: search } } },
                    { bookingNumber: { contains: search } },
                ]
            }
            if (date) {
                where.bookingItems = { some: { date: new Date(date) } }
            }

            const bookings = await prisma.booking.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, email: true, phone: true } },
                    bookingItems: { include: { court: true, teacher: true } },
                    participants: true,
                    payments: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            })
            return NextResponse.json({ bookings })
        }

        if (!user) {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }

        const bookings = await prisma.booking.findMany({
            where: { userId: user.id },
            include: {
                bookingItems: { include: { court: true, teacher: true } },
                participants: true,
                payments: true,
            },
            orderBy: { createdAt: 'desc' },
        })
        return NextResponse.json({ bookings })
    } catch (error) {
        console.error('Bookings GET error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth()
        const body = await req.json()

        const bookingNumber = generateBookingNumber()

        // Verify no conflicts
        for (const item of body.items) {
            const existing = await prisma.bookingItem.findUnique({
                where: {
                    courtId_date_startTime: {
                        courtId: item.courtId,
                        date: new Date(item.date),
                        startTime: item.startTime,
                    },
                },
                include: { booking: true },
            })
            if (existing && existing.booking.status !== 'CANCELLED') {
                return NextResponse.json(
                    { error: `สนาม ${item.courtName || ''} เวลา ${item.startTime} วันที่ ${item.date} ถูกจองแล้ว` },
                    { status: 409 }
                )
            }
        }

        const booking = await prisma.booking.create({
            data: {
                userId: user.id,
                bookingNumber,
                status: 'PENDING',
                totalAmount: body.totalAmount,
                isBookerLearner: body.isBookerLearner || false,
                createdByAdmin: body.createdByAdmin || false,
                bookingItems: {
                    create: body.items.map((item: { courtId: string; date: string; startTime: string; endTime: string; price: number; teacherId?: string }) => ({
                        courtId: item.courtId,
                        date: new Date(item.date),
                        startTime: item.startTime,
                        endTime: item.endTime,
                        price: item.price,
                        teacherId: item.teacherId || null,
                    })),
                },
                participants: body.participants
                    ? {
                        create: body.participants.map((p: { name: string; sportType: string; age?: number; shoeSize?: string; weight?: number; height?: number; phone?: string; isBooker?: boolean }) => ({
                            name: p.name,
                            sportType: p.sportType,
                            age: p.age || null,
                            shoeSize: p.shoeSize || null,
                            weight: p.weight || null,
                            height: p.height || null,
                            phone: p.phone || null,
                            isBooker: p.isBooker || false,
                        })),
                    }
                    : undefined,
            },
            include: {
                bookingItems: { include: { court: true } },
                participants: true,
            },
        })

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'BOOKING_CREATE',
                entityType: 'booking',
                entityId: booking.id,
                details: JSON.stringify({ bookingNumber, totalAmount: body.totalAmount }),
            },
        })

        // Send confirmation email (non-blocking)
        const userRecord = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, name: true } })
        if (userRecord?.email) {
            sendBookingConfirmation(userRecord.email, {
                bookingNumber,
                customerName: userRecord.name,
                items: booking.bookingItems.map(item => ({
                    courtName: item.court.name,
                    date: new Date(item.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
                    startTime: item.startTime,
                    endTime: item.endTime,
                    price: item.price,
                })),
                totalAmount: body.totalAmount,
            }).catch(err => console.error('Failed to send confirmation email:', err))
        }

        return NextResponse.json({ booking }, { status: 201 })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('Bookings POST error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
