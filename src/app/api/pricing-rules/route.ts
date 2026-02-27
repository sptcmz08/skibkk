import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
    try {
        const rules = await prisma.pricingRule.findMany({
            orderBy: [{ priority: 'desc' }, { startTime: 'asc' }]
        })
        return NextResponse.json({ rules })
    } catch (error) {
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
        const { courtId, daysOfWeek, startTime, endTime, price, includesVat, priority } = body

        const rule = await prisma.pricingRule.create({
            data: {
                courtId: courtId || null,
                daysOfWeek,
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
        const { id, courtId, daysOfWeek, startTime, endTime, price, includesVat, priority } = body

        const rule = await prisma.pricingRule.update({
            where: { id },
            data: {
                courtId: courtId || null,
                daysOfWeek,
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
