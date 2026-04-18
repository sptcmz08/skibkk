import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { sendLinePush } from '@/lib/line-messaging'
import { buildLineConfirmationMessage, DEFAULT_LINE_CONFIRMATION_NOTE } from '@/lib/line-booking-notify'
import { formatPackageDate, resolvePackageBookingWindow } from '@/lib/package-window'

const formatLineDate = (date: Date | string) => new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
const toDateOnlyUTC = (value: Date | string) => new Date(value).toISOString().split('T')[0]

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

        const packagesWithUsage = packages.map(pkg => {
            const packageUsage = usage.filter(log =>
                log.packageId === pkg.packageId &&
                log.createdAt >= pkg.purchasedAt &&
                log.createdAt <= pkg.expiresAt
            )
            return {
                ...pkg,
                usageSummary: {
                    usedCount: packageUsage.length,
                    usedHours: Math.max(0, pkg.package.totalHours - pkg.remainingHours),
                    remainingHours: pkg.remainingHours,
                },
            }
        })

        const usageWithPackageRef = usage.map(log => {
            const ownerPackage = packages.find(pkg =>
                pkg.packageId === log.packageId &&
                log.createdAt >= pkg.purchasedAt &&
                log.createdAt <= pkg.expiresAt
            )
            return {
                ...log,
                userPackageId: ownerPackage?.id || null,
            }
        })

        return NextResponse.json({ packages: packagesWithUsage, usage: usageWithPackageRef })
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

        if (bookingId) {
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: { bookingItems: { select: { date: true } } },
            })
            if (!booking || booking.userId !== user.id) {
                return NextResponse.json({ error: 'ไม่พบการจอง' }, { status: 404 })
            }

            const bookingWindow = resolvePackageBookingWindow(
                userPkg.package?.validFrom,
                userPkg.package?.validTo,
                userPkg.purchasedAt,
                userPkg.expiresAt
            )
            const packageStart = bookingWindow.start ? toDateOnlyUTC(bookingWindow.start) : toDateOnlyUTC(userPkg.purchasedAt)
            const packageEnd = bookingWindow.end ? toDateOnlyUTC(bookingWindow.end) : toDateOnlyUTC(userPkg.expiresAt)
            const outOfRangeDate = booking.bookingItems
                .map(item => toDateOnlyUTC(item.date))
                .find(date => date < packageStart || date > packageEnd)
            if (outOfRangeDate) {
                return NextResponse.json({
                    error: `จองไม่ได้: วันที่ ${formatPackageDate(outOfRangeDate)} อยู่นอกช่วงใช้แพ็คเกจ (${formatPackageDate(packageStart)} - ${formatPackageDate(packageEnd)})`,
                }, { status: 400 })
            }
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
                    packageUsage: {
                        packageName: userPkg.package?.name || null,
                        hoursUsed: hoursToDeduct,
                        hoursRemaining: userPkg.remainingHours - hoursToDeduct,
                    },
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
