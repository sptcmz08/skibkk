import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requireAdmin } from '@/lib/auth'

const toDateNoonUTC = (dateStr?: string | null) => dateStr ? new Date(`${dateStr.split('T')[0]}T12:00:00Z`) : null

export async function GET() {
    try {
        await requireAdmin()
        const rules = await prisma.pricingRule.findMany({
            include: { court: { include: { venue: true } } },
            orderBy: [{ priority: 'desc' }, { startTime: 'asc' }]
        })
        return NextResponse.json({ rules })
    } catch (error) {
        if ((error as Error).message === 'Forbidden') {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }
        console.error('[PricingRule GET] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser()
        if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERUSER' && user.role !== 'STAFF')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { courtId, daysOfWeek, validFrom, validTo, startTime, endTime, price, includesVat, priority } = body
        const normalizedValidFrom = toDateNoonUTC(validFrom)
        const normalizedValidTo = toDateNoonUTC(validTo)

        if (normalizedValidFrom && normalizedValidTo && normalizedValidFrom > normalizedValidTo) {
            return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
        }

        const rule = await prisma.pricingRule.create({
            data: {
                courtId: courtId || null,
                daysOfWeek,
                validFrom: normalizedValidFrom,
                validTo: normalizedValidTo,
                startTime,
                endTime,
                price: parseFloat(price.toString()),
                includesVat: includesVat || false,
                priority: priority || 0
            }
        })
        return NextResponse.json({ rule })
    } catch (error) {
        console.error('[PricingRule POST] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PUT(req: Request) {
    try {
        const user = await getCurrentUser()
        if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERUSER' && user.role !== 'STAFF')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { id, courtId, daysOfWeek, validFrom, validTo, startTime, endTime, price, includesVat, priority } = body
        const normalizedValidFrom = toDateNoonUTC(validFrom)
        const normalizedValidTo = toDateNoonUTC(validTo)

        if (normalizedValidFrom && normalizedValidTo && normalizedValidFrom > normalizedValidTo) {
            return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
        }

        const rule = await prisma.pricingRule.update({
            where: { id },
            data: {
                courtId: courtId || null,
                daysOfWeek,
                validFrom: normalizedValidFrom,
                validTo: normalizedValidTo,
                startTime,
                endTime,
                price: parseFloat(price.toString()),
                includesVat: includesVat || false,
                priority: priority || 0
            }
        })
        return NextResponse.json({ rule })
    } catch (error) {
        console.error('[PricingRule PUT] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const user = await getCurrentUser()
        if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERUSER' && user.role !== 'STAFF')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { id } = body

        await prisma.pricingRule.delete({
            where: { id }
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[PricingRule DELETE] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
