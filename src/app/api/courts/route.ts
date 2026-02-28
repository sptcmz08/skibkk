import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    try {
        const isAdmin = req.nextUrl.searchParams.get('admin') === '1'
        const venueId = req.nextUrl.searchParams.get('venueId')

        const where: any = isAdmin
            ? {} // Admin sees all courts
            : { status: { in: ['ACTIVE', 'CLOSED'] } }

        if (venueId) {
            where.venueId = venueId
        }

        const courts = await prisma.court.findMany({
            where,
            include: {
                operatingHours: true,
                pricingRules: { where: { isActive: true } },
                venue: true,
            },
            orderBy: { sortOrder: 'asc' },
        })
        return NextResponse.json({ courts }, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
            },
        })
    } catch (error) {
        console.error('Courts GET error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        await requireAdmin()
        const body = await req.json()

        if (body.id) {
            // Update existing court
            const court = await prisma.court.update({
                where: { id: body.id },
                data: {
                    name: body.name,
                    description: body.description || null,
                    sportType: body.sportType || null,
                    status: body.status || 'ACTIVE',
                    isActive: body.status !== 'HIDDEN',
                    sortOrder: parseInt(body.sortOrder) || 0,
                    venueId: body.venueId || null,
                    operatingHours: {
                        deleteMany: {},
                        create: (body.operatingHours || []).map((oh: { dayOfWeek: string; openTime: string; closeTime: string; isClosed: boolean }) => ({
                            dayOfWeek: oh.dayOfWeek,
                            openTime: oh.openTime,
                            closeTime: oh.closeTime,
                            isClosed: oh.isClosed || false,
                        })),
                    },
                },
                include: { operatingHours: true },
            })
            return NextResponse.json({ court })
        }

        const court = await prisma.court.create({
            data: {
                name: body.name,
                description: body.description || null,
                sportType: body.sportType || null,
                status: body.status || 'ACTIVE',
                sortOrder: parseInt(body.sortOrder) || 0,
                venueId: body.venueId || null,
                operatingHours: {
                    create: (body.operatingHours || []).map((oh: { dayOfWeek: string; openTime: string; closeTime: string; isClosed: boolean }) => ({
                        dayOfWeek: oh.dayOfWeek,
                        openTime: oh.openTime,
                        closeTime: oh.closeTime,
                        isClosed: oh.isClosed || false,
                    })),
                },
            },
            include: { operatingHours: true },
        })

        return NextResponse.json({ court }, { status: 201 })
    } catch (error) {
        if ((error as Error).message === 'Forbidden') {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }
        console.error('Courts POST error:', error)
        return NextResponse.json({ error: (error as Error).message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    try {
        await requireAdmin()
        const { id } = await req.json()
        if (!id) return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 400 })

        // Check if court has bookings
        const bookingCount = await prisma.bookingItem.count({ where: { courtId: id } })
        if (bookingCount > 0) {
            return NextResponse.json({ error: `ลบไม่ได้ สนามนี้มีข้อมูลการจอง ${bookingCount} รายการ กรุณาเปลี่ยนสถานะเป็น "ยกเลิก" แทน` }, { status: 400 })
        }

        await prisma.court.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        if ((error as Error).message === 'Forbidden') {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }
        console.error('Courts DELETE error:', error)
        return NextResponse.json({ error: 'ลบไม่สำเร็จ อาจมีข้อมูลจองอยู่' }, { status: 500 })
    }
}
