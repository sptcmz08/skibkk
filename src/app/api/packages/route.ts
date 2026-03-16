import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — list all packages
export async function GET() {
    try {
        const packages = await prisma.package.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { userPackages: true } },
            },
        })
        return NextResponse.json({ packages })
    } catch (error) {
        console.error('GET /api/packages error:', error)
        return NextResponse.json({ packages: [] })
    }
}

// POST — create a new package
export async function POST(req: NextRequest) {
    try {
        await requireAdmin()
        const { name, description, totalHours, price, validDays, validFrom, validTo, isActive } = await req.json()
        if (!name || !totalHours || !price) {
            return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 })
        }
        const pkg = await prisma.package.create({
            data: {
                name,
                description: description || null,
                totalHours: parseInt(totalHours),
                price: parseFloat(price),
                validDays: parseInt(validDays) || 30,
                validFrom: validFrom ? new Date(validFrom) : null,
                validTo: validTo ? new Date(validTo) : null,
                isActive: isActive !== false,
            },
        })
        return NextResponse.json({ package: pkg })
    } catch (error) {
        console.error('POST /api/packages error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// PUT — update a package
export async function PUT(req: NextRequest) {
    try {
        await requireAdmin()
        const { id, name, description, totalHours, price, validDays, validFrom, validTo, isActive } = await req.json()
        if (!id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 })
        const pkg = await prisma.package.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(totalHours !== undefined && { totalHours: parseInt(totalHours) }),
                ...(price !== undefined && { price: parseFloat(price) }),
                ...(validDays !== undefined && { validDays: parseInt(validDays) }),
                ...(validFrom !== undefined && { validFrom: validFrom ? new Date(validFrom) : null }),
                ...(validTo !== undefined && { validTo: validTo ? new Date(validTo) : null }),
                ...(isActive !== undefined && { isActive }),
            },
        })
        return NextResponse.json({ package: pkg })
    } catch (error) {
        console.error('PUT /api/packages error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// DELETE — delete a package
export async function DELETE(req: NextRequest) {
    try {
        await requireAdmin()
        const { id } = await req.json()
        if (!id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 })
        await prisma.package.delete({ where: { id } })
        return NextResponse.json({ message: 'ลบแพ็คเกจแล้ว' })
    } catch (error) {
        console.error('DELETE /api/packages error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
