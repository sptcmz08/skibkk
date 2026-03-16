import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — list all user-packages (admin view)
export async function GET(req: NextRequest) {
    try {
        await requireAdmin()
        const { searchParams } = new URL(req.url)
        const userId = searchParams.get('userId')

        const where: Record<string, unknown> = {}
        if (userId) where.userId = userId

        const userPackages = await prisma.userPackage.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true, phone: true } },
                package: true,
            },
            orderBy: { purchasedAt: 'desc' },
        })
        return NextResponse.json({ userPackages })
    } catch (error) {
        console.error('GET /api/admin/user-packages error:', error)
        return NextResponse.json({ userPackages: [] })
    }
}

// POST — assign a package to a customer
export async function POST(req: NextRequest) {
    try {
        await requireAdmin()
        const { userId, packageId } = await req.json()
        if (!userId || !packageId) {
            return NextResponse.json({ error: 'ต้องระบุ userId และ packageId' }, { status: 400 })
        }

        const pkg = await prisma.package.findUnique({ where: { id: packageId } })
        if (!pkg) return NextResponse.json({ error: 'ไม่พบแพ็คเกจ' }, { status: 404 })

        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 404 })

        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + pkg.validDays)

        const userPackage = await prisma.userPackage.create({
            data: {
                userId,
                packageId,
                remainingHours: pkg.totalHours,
                expiresAt,
            },
            include: {
                user: { select: { name: true } },
                package: { select: { name: true } },
            },
        })

        return NextResponse.json({ userPackage })
    } catch (error) {
        console.error('POST /api/admin/user-packages error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// DELETE — remove a user-package
export async function DELETE(req: NextRequest) {
    try {
        await requireAdmin()
        const { id } = await req.json()
        if (!id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 })
        await prisma.userPackage.delete({ where: { id } })
        return NextResponse.json({ message: 'ลบแพ็คเกจของลูกค้าแล้ว' })
    } catch (error) {
        console.error('DELETE /api/admin/user-packages error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
