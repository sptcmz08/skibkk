import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { sendLinePush } from '@/lib/line-messaging'
import { buildLineConfirmationMessage, DEFAULT_LINE_CONFIRMATION_NOTE } from '@/lib/line-booking-notify'

const formatLineDate = (date: Date | string) => new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

export const dynamic = 'force-dynamic'

// GET — get current user's packages (+ optional usage history)
export async function GET(req: NextRequest) {
    try {
        const user = await requireAuth()
        const { searchParams } = new URL(req.url)
        const includeAll = searchParams.get('includeAll') === '1'
        const withUsage = searchParams.get('withUsage') === '1'

        const packages = await prisma.userPackage.findMany({
            where: {
                userId: user.id,
                ...(includeAll ? {} : {
                    remainingHours: { gt: 0 },
                    expiresAt: { gt: new Date() },
                }),
            },
            include: { package: true },
            orderBy: { expiresAt: 'asc' },
        })

        if (!withUsage) return NextResponse.json({ packages })

        const usage = await prisma.payment.findMany({
            where: {
                userId: user.id,
                method: 'PACKAGE',
            },
            include: {
                booking: {
                    include: {
                        bookingItems: {
                            include: { court: { select: { name: true } } },
                            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json({ packages, usage })
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

        if (!userPackageId || !hoursToDeduct || hoursToDeduct <= 0 || !Number.isInteger(hoursToDeduct)) {
            return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
        }
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

        await prisma.$transaction(async tx => {
            // Deduct hours
            await tx.userPackage.update({
                where: { id: userPackageId },
                data: { remainingHours: { decrement: hoursToDeduct } },
            })

            // Update booking payment method
            if (bookingId) {
                await tx.payment.create({
                    data: {
                        bookingId,
                        userId: user.id,
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
            }
        })

        if (bookingId) {
            const confirmedBooking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: {
                    bookingItems: { include: { court: true } },
                    user: { select: { name: true, lineUserId: true } },
                },
            })
            if (confirmedBooking?.user?.lineUserId) {
                const templateSetting = await prisma.siteSetting.findUnique({ where: { key: 'line_booking_confirmation_template' } })
                const message = buildLineConfirmationMessage(templateSetting?.value || DEFAULT_LINE_CONFIRMATION_NOTE, {
                    bookingNumber: confirmedBooking.bookingNumber,
                    customerName: confirmedBooking.user.name,
                    items: confirmedBooking.bookingItems.map(item => ({
                        courtName: item.court.name,
                        date: formatLineDate(item.date),
                        startTime: item.startTime,
                        endTime: item.endTime,
                        price: item.price,
                    })),
                    totalAmount: confirmedBooking.totalAmount,
                })
                sendLinePush(confirmedBooking.user.lineUserId, [{ type: 'text', text: message }]).catch(err => console.error('Failed to send LINE confirmation:', err))
            }
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
