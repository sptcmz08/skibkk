import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const teachers = await prisma.teacher.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, specialty: true, phone: true, email: true },
        })
        return NextResponse.json({ teachers })
    } catch (error) {
        console.error('GET /api/teachers error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
