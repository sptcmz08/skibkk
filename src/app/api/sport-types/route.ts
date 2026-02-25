import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const sportTypes = await prisma.sportType.findMany({
            orderBy: { sortOrder: 'asc' },
        })
        return NextResponse.json({ sportTypes })
    } catch (error) {
        console.error('Sport types GET error:', error)
        return NextResponse.json({ sportTypes: [] })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { id, name, icon, color, sortOrder, isActive } = body

        if (!name?.trim()) {
            return NextResponse.json({ error: 'กรุณาระบุชื่อประเภทกีฬา' }, { status: 400 })
        }

        if (id) {
            // Update
            const updated = await prisma.sportType.update({
                where: { id },
                data: { name: name.trim(), icon, color, sortOrder: sortOrder ?? 0, isActive: isActive ?? true },
            })
            return NextResponse.json({ sportType: updated })
        } else {
            // Create
            const count = await prisma.sportType.count()
            const created = await prisma.sportType.create({
                data: { name: name.trim(), icon: icon || '🏟️', color: color || '#f59e0b', sortOrder: sortOrder ?? count },
            })
            return NextResponse.json({ sportType: created })
        }
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'ชื่อประเภทกีฬานี้มีอยู่แล้ว' }, { status: 400 })
        }
        console.error('Sport types POST error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

        await prisma.sportType.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Sport types DELETE error:', error)
        return NextResponse.json({ error: 'ลบไม่สำเร็จ' }, { status: 500 })
    }
}
