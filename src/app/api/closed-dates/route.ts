import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

// GET — list closed dates
export async function GET() {
    try {
        const dates = await prisma.closedDate.findMany({ orderBy: { date: 'asc' } })
        return NextResponse.json({ dates })
    } catch (error) {
        console.error('GET /api/closed-dates error:', error)
        return NextResponse.json({ dates: [] })
    }
}

// POST — add closed date
export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }
        const { date, reason } = await req.json()
        const closedDate = await prisma.closedDate.create({
            data: { date: new Date(date), reason: reason || null },
        })
        return NextResponse.json({ closedDate }, { status: 201 })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        console.error('POST /api/closed-dates error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// DELETE — remove closed date
export async function DELETE(req: NextRequest) {
    try {
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }
        const { id } = await req.json()
        await prisma.closedDate.delete({ where: { id } })
        return NextResponse.json({ message: 'ลบวันหยุดสำเร็จ' })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        console.error('DELETE /api/closed-dates error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
