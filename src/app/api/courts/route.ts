import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
    try {
        const courts = await prisma.court.findMany({
            where: { isActive: true },
            include: {
                operatingHours: true,
                pricingRules: { where: { isActive: true } },
            },
            orderBy: { sortOrder: 'asc' },
        })
        return NextResponse.json({ courts })
    } catch (error) {
        console.error('Courts GET error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        await requireAdmin()
        const body = await req.json()

        const court = await prisma.court.create({
            data: {
                name: body.name,
                description: body.description || null,
                sortOrder: body.sortOrder || 0,
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
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
