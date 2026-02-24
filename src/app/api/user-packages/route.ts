import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — get current user's active packages
export async function GET() {
    try {
        const user = await requireAuth()

        const packages = await prisma.userPackage.findMany({
            where: {
                userId: user.id,
                remainingHours: { gt: 0 },
                expiresAt: { gt: new Date() },
            },
            include: { package: true },
            orderBy: { expiresAt: 'asc' },
        })

        return NextResponse.json({ packages })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        return NextResponse.json({ packages: [] })
    }
}

// POST — deduct hours from a package for a booking
export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth()
        const { userPackageId, hoursToDeduct, bookingId } = await req.json()

        const userPkg = await prisma.userPackage.findUnique({
            where: { id: userPackageId },
            include: { package: true },
        })

        if (!userPkg || userPkg.userId !== user.id) {
            return NextResponse.json({ error: 'ไม่พบแพ็คเกจ' }, { status: 404 })
        }

        if (userPkg.remainingHours < hoursToDeduct) {
            return NextResponse.json({ error: 'ชั่วโมงในแพ็คเกจไม่เพียงพอ' }, { status: 400 })
        }

        if (userPkg.expiresAt < new Date()) {
            return NextResponse.json({ error: 'แพ็คเกจหมดอายุแล้ว' }, { status: 400 })
        }

        // Deduct hours
        await prisma.userPackage.update({
            where: { id: userPackageId },
            data: { remainingHours: { decrement: hoursToDeduct } },
        })

        // Update booking payment method
        if (bookingId) {
            await prisma.payment.create({
                data: {
                    bookingId,
                    userId: user.id,
                    method: 'PACKAGE',
                    amount: 0,
                    status: 'VERIFIED',
                    verifiedAt: new Date(),
                    verifiedBy: 'SYSTEM',
                },
            })
            await prisma.booking.update({
                where: { id: bookingId },
                data: { status: 'CONFIRMED' },
            })
        }

        return NextResponse.json({
            message: 'ตัดชั่วโมงจากแพ็คเกจสำเร็จ',
            remaining: userPkg.remainingHours - hoursToDeduct,
        })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('Package deduct error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
