import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const venues = await prisma.venue.findMany({
            orderBy: { sortOrder: 'asc' },
        })
        return NextResponse.json({ venues })
    } catch (error) {
        console.error('Venues GET error:', error)
        return NextResponse.json({ venues: [] })
    }
}

export async function POST(req: NextRequest) {
    try {
        await requireAdmin()
        const body = await req.json()
        const { id, name, image, description, isActive } = body

        if (!name?.trim()) {
            return NextResponse.json({ error: 'กรุณาระบุชื่อสถานที่' }, { status: 400 })
        }

        if (id) {
            const updated = await prisma.venue.update({
                where: { id },
                data: { name: name.trim(), image: image || null, description: description || null, isActive: isActive ?? true },
            })
            return NextResponse.json({ venue: updated })
        } else {
            const count = await prisma.venue.count()
            const created = await prisma.venue.create({
                data: { name: name.trim(), image: image || null, description: description || null, sortOrder: count },
            })
            return NextResponse.json({ venue: created })
        }
    } catch (error) {
        console.error('Venues POST error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    try {
        await requireAdmin()
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

        const courtCount = await prisma.court.count({ where: { venueId: id } })
        if (courtCount > 0) {
            return NextResponse.json({ error: `ลบไม่ได้ สถานที่นี้มี ${courtCount} สนาม กรุณาย้ายสนามก่อน` }, { status: 400 })
        }

        await prisma.venue.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Venues DELETE error:', error)
        return NextResponse.json({ error: 'ลบไม่สำเร็จ' }, { status: 500 })
    }
}
