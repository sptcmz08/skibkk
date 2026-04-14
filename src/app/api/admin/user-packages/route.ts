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

// PATCH — consume package hours for an admin-created booking
export async function PATCH(req: NextRequest) {
    try {
        await requireAdmin()
        const { userPackageId, bookingId, hoursToDeduct } = await req.json()

        if (!userPackageId || !bookingId || !hoursToDeduct || !Number.isInteger(hoursToDeduct) || hoursToDeduct <= 0) {
            return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
        }

        const userPkg = await prisma.userPackage.findUnique({
            where: { id: userPackageId },
            include: { package: true },
        })
        if (!userPkg) return NextResponse.json({ error: 'ไม่พบแพ็คเกจลูกค้า' }, { status: 404 })
        if (userPkg.remainingHours < hoursToDeduct) {
            return NextResponse.json({ error: 'ชั่วโมงแพ็คเกจไม่เพียงพอ' }, { status: 400 })
        }
        if (userPkg.expiresAt < new Date()) {
            return NextResponse.json({ error: 'แพ็คเกจหมดอายุแล้ว' }, { status: 400 })
        }

        const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
        if (!booking) return NextResponse.json({ error: 'ไม่พบการจอง' }, { status: 404 })
        if (booking.userId !== userPkg.userId) {
            return NextResponse.json({ error: 'แพ็คเกจนี้ไม่ใช่ของลูกค้าในการจองนี้' }, { status: 400 })
        }

        await prisma.$transaction(async tx => {
            await tx.userPackage.update({
                where: { id: userPackageId },
                data: { remainingHours: { decrement: hoursToDeduct } },
            })
            await tx.payment.create({
                data: {
                    bookingId,
                    userId: userPkg.userId,
                    method: 'PACKAGE',
                    amount: 0,
                    status: 'VERIFIED',
                    verifiedAt: new Date(),
                    verifiedBy: 'SYSTEM',
                    packageId: userPkg.packageId,
                },
            })
            await tx.bookingItem.updateMany({
                where: { bookingId },
                data: { price: 0 },
            })
            await tx.booking.update({
                where: { id: bookingId },
                data: {
                    status: 'CONFIRMED',
                    totalAmount: 0,
                    notes: userPkg.package?.name ? `ชำระด้วยแพ็คเกจ: ${userPkg.package.name}` : 'ชำระด้วยแพ็คเกจ',
                },
            })
        })

        return NextResponse.json({ message: 'ตัดชั่วโมงแพ็คเกจสำเร็จ' })
    } catch (error) {
        console.error('PATCH /api/admin/user-packages error:', error)
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
