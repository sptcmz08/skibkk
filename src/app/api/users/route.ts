import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAdmin } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// GET — search users (admin only)
export async function GET(req: NextRequest) {
    try {
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const search = searchParams.get('search') || ''
        const role = searchParams.get('role') || ''
        const listAll = searchParams.get('all') === '1'

        const where: Record<string, unknown> = {}
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
            ]
        }
        if (role) where.role = role

        // For admin users list: show only staff/admin/superuser
        if (listAll) {
            where.role = { in: ['ADMIN', 'STAFF', 'SUPERUSER'] }
        }

        const users = await prisma.user.findMany({
            where,
            select: {
                id: true, name: true, email: true, phone: true,
                role: true, isActive: true, createdAt: true,
                _count: { select: { bookings: true } },
            },
            take: listAll ? 100 : 20,
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json({ users })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        return NextResponse.json({ users: [] })
    }
}

// POST — create admin/staff user
export async function POST(req: NextRequest) {
    try {
        await requireAdmin()
        const body = await req.json()

        if (!body.name || !body.email || !body.password) {
            return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 })
        }

        // Check duplicate email
        const existing = await prisma.user.findUnique({ where: { email: body.email } })
        if (existing) {
            return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }, { status: 400 })
        }

        const hashedPassword = await bcrypt.hash(body.password, 10)

        const user = await prisma.user.create({
            data: {
                name: body.name,
                email: body.email,
                password: hashedPassword,
                phone: body.phone || `staff-${Date.now()}`,
                role: body.role || 'STAFF',
                isActive: true,
            },
            select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
        })

        return NextResponse.json({ user }, { status: 201 })
    } catch (error) {
        if ((error as Error).message === 'Forbidden') {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }
        console.error('Users POST error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// PATCH — edit user
export async function PATCH(req: NextRequest) {
    try {
        await requireAdmin()
        const body = await req.json()
        const { userId, name, email, phone, role, password } = body

        if (!userId) return NextResponse.json({ error: 'ระบุ user id' }, { status: 400 })

        const updateData: Record<string, unknown> = {}
        if (name) updateData.name = name
        if (email) updateData.email = email
        if (phone) updateData.phone = phone
        if (role) updateData.role = role
        if (password) updateData.password = await bcrypt.hash(password, 10)

        const user = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
        })

        return NextResponse.json({ user })
    } catch (error) {
        if ((error as Error).message === 'Forbidden') {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }
        console.error('Users PATCH error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// DELETE — actually delete user
export async function DELETE(req: NextRequest) {
    try {
        await requireAdmin()
        const { searchParams } = new URL(req.url)
        const userId = searchParams.get('id')
        if (!userId) return NextResponse.json({ error: 'ระบุ user id' }, { status: 400 })

        await prisma.user.delete({
            where: { id: userId },
        })

        return NextResponse.json({ message: 'ลบผู้ใช้สำเร็จ' })
    } catch (error) {
        if ((error as Error).message === 'Forbidden') {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }
        console.error('Users DELETE error:', error)
        return NextResponse.json({ error: 'ไม่สามารถลบได้ อาจมีข้อมูลที่เชื่อมโยงอยู่' }, { status: 500 })
    }
}
