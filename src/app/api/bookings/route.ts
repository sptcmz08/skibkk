import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requireAuth } from '@/lib/auth'
import { generateNextBookingNumber } from '@/lib/document-number-service'
import { publishRealtimeEvent } from '@/lib/realtime-events'
import { sendLinePush } from '@/lib/line-messaging'
import {
    DEFAULT_LINE_CONFIRMATION_TEMPLATE,
    DEFAULT_LINE_UPDATE_TEMPLATE,
    renderLineBookingTemplate,
} from '@/lib/line-booking-notify'

// Helper: convert date string "YYYY-MM-DD" to Date at noon UTC
// This prevents @db.Date (PostgreSQL DATE) from shifting ±1 day due to timezone offsets
const toDateNoonUTC = (dateStr: string) => new Date(dateStr.split('T')[0] + 'T12:00:00Z')

export const dynamic = 'force-dynamic'

const hasCode = (error: unknown, code: string): error is { code: string } =>
    typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === code

const hasTargetField = (error: unknown, field: string) => {
    if (typeof error !== 'object' || error === null || !('meta' in error)) return false
    const meta = (error as { meta?: { target?: string[] | string } }).meta
    const target = meta?.target
    if (Array.isArray(target)) return target.includes(field)
    return target === field
}

const formatLineDate = (date: Date | string) => new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

const getLineBookingTemplates = async () => {
    const settings = await prisma.siteSetting.findMany({
        where: {
            key: {
                in: ['line_booking_confirmation_template', 'line_booking_update_template'],
            },
        },
    })

    const settingsMap = Object.fromEntries(settings.map(setting => [setting.key, setting.value]))

    return {
        confirmation: settingsMap.line_booking_confirmation_template || DEFAULT_LINE_CONFIRMATION_TEMPLATE,
        update: settingsMap.line_booking_update_template || DEFAULT_LINE_UPDATE_TEMPLATE,
    }
}

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        const { searchParams } = new URL(req.url)

        // Admin can see all bookings, customers only their own
        if (user && ['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            const date = searchParams.get('date')
            const status = searchParams.get('status')
            const search = searchParams.get('search')

            const where: Record<string, unknown> = {}
            if (status) where.status = status
            if (search) {
                where.OR = [
                    { user: { name: { contains: search, mode: 'insensitive' } } },
                    { user: { phone: { contains: search } } },
                    { bookingNumber: { contains: search } },
                ]
            }
            if (date) {
                // Match @db.Date field — use wide UTC range that covers any timezone
                const startOfDay = new Date(date + 'T00:00:00Z')
                const endOfDay = new Date(date + 'T23:59:59Z')
                where.bookingItems = { some: { date: { gte: startOfDay, lte: endOfDay } } }
            }

            // Month filter for calendar view: ?month=2026-03
            const monthParam = searchParams.get('month')
            if (monthParam && !date) {
                const [y, m] = monthParam.split('-').map(Number)
                // Use timezone-aware dates to match @db.Date field properly
                const startDate = new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00Z`)
                const lastDay = new Date(y, m, 0).getDate()
                const endDate = new Date(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59Z`)
                where.bookingItems = { some: { date: { gte: startDate, lte: endDate } } }
            }

            const bookings = await prisma.booking.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, email: true, phone: true, lineUserId: true, lineDisplayName: true, lineAvatar: true } },
                    bookingItems: { include: { court: { include: { venue: true } }, teacher: true, originalCourt: true } },
                    participants: true,
                    payments: true,
                    invoice: { select: { id: true, invoiceNumber: true, isIssued: true, issuedAt: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: parseInt(searchParams.get('take') || '100'),
            })
            return NextResponse.json({ bookings }, {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                },
            })
        }

        if (!user) {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }

        const bookings = await prisma.booking.findMany({
            where: { userId: user.id },
            include: {
                bookingItems: { include: { court: { include: { venue: true } }, teacher: true, originalCourt: true } },
                participants: true,
                payments: true,
                invoice: { select: { id: true, invoiceNumber: true, isIssued: true, issuedAt: true } },
            },
            orderBy: { createdAt: 'desc' },
        })
        return NextResponse.json({ bookings }, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
            },
        })
    } catch (error) {
        console.error('Bookings GET error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth()
        const body = await req.json()

        // Admin can create bookings on behalf of customers
        let bookingUserId = user.id
        if (body.createdByAdmin && ['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            if (body.userId) {
                // Existing customer selected
                bookingUserId = body.userId
            } else if (body.guestName) {
                // New customer — create or find by phone
                let customer = body.guestPhone
                    ? await prisma.user.findFirst({ where: { phone: body.guestPhone, role: 'CUSTOMER' } })
                    : null
                if (!customer) {
                    customer = await prisma.user.create({
                        data: {
                            name: body.guestName.trim(),
                            email: `guest-${Date.now()}@skibkk.local`,
                            phone: body.guestPhone?.trim() || `guest-${Date.now()}`,
                            role: 'CUSTOMER',
                            lineUserId: body.guestLineId?.trim() || null,
                        },
                    })
                }
                bookingUserId = customer.id
            }
        }

        // Verify no conflicts
        for (const item of body.items) {
            const existing = await prisma.bookingItem.findUnique({
                where: {
                    courtId_date_startTime: {
                        courtId: item.courtId,
                        date: toDateNoonUTC(item.date),
                        startTime: item.startTime,
                    },
                },
                include: { booking: true },
            })
            if (existing && existing.booking.status !== 'CANCELLED') {
                return NextResponse.json(
                    { error: `สนาม ${item.courtName || ''} เวลา ${item.startTime} วันที่ ${item.date} ถูกจองแล้ว` },
                    { status: 409 }
                )
            }
        }

        let bookingNumber = ''
        let booking = null

        for (let attempt = 0; attempt < 5; attempt++) {
            bookingNumber = await generateNextBookingNumber()
            try {
                booking = await prisma.booking.create({
                    data: {
                        userId: bookingUserId,
                        bookingNumber,
                        status: 'PENDING',
                        totalAmount: body.totalAmount,
                        isBookerLearner: body.isBookerLearner || false,
                        createdByAdmin: body.createdByAdmin || false,
                        bookingItems: {
                            create: body.items.map((item: { courtId: string; date: string; startTime: string; endTime: string; price: number; teacherId?: string }) => ({
                                courtId: item.courtId,
                                date: toDateNoonUTC(item.date),
                                startTime: item.startTime,
                                endTime: item.endTime,
                                price: item.price,
                                teacherId: item.teacherId || null,
                            })),
                        },
                        participants: body.participants
                            ? {
                                create: body.participants.map((p: { name: string; sportType: string; age?: number; shoeSize?: string; weight?: number; height?: number; phone?: string; isBooker?: boolean }) => ({
                                    name: p.name,
                                    sportType: p.sportType,
                                    age: p.age || null,
                                    shoeSize: p.shoeSize || null,
                                    weight: p.weight || null,
                                    height: p.height || null,
                                    phone: p.phone || null,
                                    isBooker: p.isBooker || false,
                                })),
                            }
                            : undefined,
                    },
                    include: {
                        bookingItems: { include: { court: true } },
                        participants: true,
                    },
                })
                break
            } catch (error) {
                if (hasCode(error, 'P2002') && hasTargetField(error, 'bookingNumber') && attempt < 4) {
                    continue
                }
                throw error
            }
        }

        if (!booking) {
            throw new Error('BOOKING_NUMBER_GENERATION_FAILED')
        }

        // Create payment record with selected method (admin bookings)
        if (body.paymentMethod) {
            await prisma.payment.create({
                data: {
                    bookingId: booking.id,
                    userId: bookingUserId,
                    method: body.paymentMethod, // CASH, BANK_TRANSFER, CREDIT_CARD
                    amount: body.totalAmount,
                    bankName: body.bankName || null,
                    status: 'VERIFIED',
                    verifiedAt: new Date(),
                    verifiedBy: user.id,
                },
            })
        }
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'BOOKING_CREATE',
                entityType: 'booking',
                entityId: booking.id,
                details: JSON.stringify({ bookingNumber, totalAmount: body.totalAmount }),
            },
        })

        // Send confirmation via LINE (non-blocking)
        const userRecord = await prisma.user.findUnique({ where: { id: bookingUserId }, select: { email: true, name: true, lineUserId: true } })
        if (userRecord?.lineUserId) {
            const templates = await getLineBookingTemplates()
            const message = renderLineBookingTemplate(templates.confirmation, {
                bookingNumber,
                customerName: userRecord.name,
                items: booking.bookingItems.map(item => ({
                    courtName: item.court.name,
                    date: formatLineDate(item.date),
                    startTime: item.startTime,
                    endTime: item.endTime,
                    price: item.price,
                })),
                totalAmount: body.totalAmount,
            }, DEFAULT_LINE_CONFIRMATION_TEMPLATE)
            sendLinePush(userRecord.lineUserId, [{ type: 'text', text: message }]).catch(err => console.error('Failed to send LINE confirmation:', err))
        }

        publishRealtimeEvent({
            type: 'booking_created',
            bookingId: booking.id,
            bookingNumber,
            status: booking.status,
            source: body.createdByAdmin ? 'admin' : 'customer',
            affectedDates: [...new Set(booking.bookingItems.map(item => item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date).split('T')[0]))],
            courtIds: [...new Set(booking.bookingItems.map(item => item.courtId))],
            message: 'booking created',
        })

        return NextResponse.json({ booking }, { status: 201 })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        if (hasCode(error, 'P2002')) {
            return NextResponse.json({ error: 'สนามเวลานี้ถูกจองแล้ว กรุณาเลือกเวลาอื่น' }, { status: 409 })
        }
        console.error('Bookings POST error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// PATCH — edit/cancel booking (admin)
export async function PATCH(req: NextRequest) {
    try {
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const body = await req.json()
        const { bookingId, action, reason, ...updateData } = body

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { bookingItems: true },
        })
        if (!booking) return NextResponse.json({ error: 'ไม่พบการจอง' }, { status: 404 })

        if (action === 'cancel') {
            await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } })
            await prisma.auditLog.create({
                data: {
                    userId: user.id, action: 'BOOKING_CANCEL', entityType: 'booking', entityId: bookingId,
                    details: JSON.stringify({ bookingNumber: booking.bookingNumber, reason: reason || 'Admin cancelled' }),
                },
            })
            return NextResponse.json({ message: 'ยกเลิกการจองสำเร็จ' })
        }

        // Update participants if provided
        if (updateData.participants && Array.isArray(updateData.participants)) {
            await prisma.participant.deleteMany({ where: { bookingId } })
            await prisma.participant.createMany({
                data: updateData.participants.map((p: { name: string; sportType: string; phone?: string; height?: number; weight?: number; isBooker?: boolean }) => ({
                    bookingId,
                    name: p.name,
                    sportType: p.sportType || '-',
                    phone: p.phone || '',
                    height: p.height ? parseFloat(String(p.height)) : null,
                    weight: p.weight ? parseFloat(String(p.weight)) : null,
                    isBooker: p.isBooker || false,
                })),
            })
        }

        // Update bookingItems if provided (admin can change court, date, time, price)
        if (updateData.bookingItems && Array.isArray(updateData.bookingItems)) {
            // Check for duplicate slots WITHIN the submitted items (same court+date+startTime)
            const slotKeys = new Set<string>()
            for (const item of updateData.bookingItems) {
                const startH = parseInt(item.startTime.split(':')[0])
                const endH = parseInt(item.endTime.split(':')[0]) || 24
                for (let h = startH; h < endH; h++) {
                    const key = `${item.courtId}_${item.date.split('T')[0]}_${String(h).padStart(2, '0')}:00`
                    if (slotKeys.has(key)) {
                        return NextResponse.json(
                            { error: `ไม่สามารถย้ายไปเวลาที่ซ้ำกันได้ (${item.date.split('T')[0]} ${String(h).padStart(2, '0')}:00)` },
                            { status: 409 }
                        )
                    }
                    slotKeys.add(key)
                }
            }

            // Conflict check: verify no other booking occupies these slots
            for (const item of updateData.bookingItems) {
                const startH = parseInt(item.startTime.split(':')[0])
                const endH = parseInt(item.endTime.split(':')[0]) || 24
                for (let h = startH; h < endH; h++) {
                    const slotTime = `${String(h).padStart(2, '0')}:00`
                    const existing = await prisma.bookingItem.findUnique({
                        where: {
                            courtId_date_startTime: {
                                courtId: item.courtId,
                                date: toDateNoonUTC(item.date),
                                startTime: slotTime,
                            },
                        },
                        include: { booking: true },
                    })
                    if (existing && existing.bookingId !== bookingId && existing.booking.status !== 'CANCELLED') {
                        return NextResponse.json(
                            { error: `สนามเวลา ${slotTime} วันที่ ${item.date} ถูกจองแล้ว` },
                            { status: 409 }
                        )
                    }
                }
            }

            // Read existing items to preserve original data
            const existingItems = await prisma.bookingItem.findMany({
                where: { bookingId },
                orderBy: { startTime: 'asc' },
            })

            await prisma.bookingItem.deleteMany({ where: { bookingId } })
            await prisma.bookingItem.createMany({
                data: updateData.bookingItems.map((item: { courtId: string; date: string; startTime: string; endTime: string; price: number; teacherId?: string | null; originalCourtId?: string | null; originalDate?: string | null; originalStartTime?: string | null; originalEndTime?: string | null }, idx: number) => {
                    const oldItem = existingItems[idx]
                    // Determine original values: keep existing originals if set, otherwise use old item's current values if data changed
                    let origCourtId = item.originalCourtId || oldItem?.originalCourtId || null
                    let origDate = item.originalDate ? toDateNoonUTC(item.originalDate) : (oldItem?.originalDate || null)
                    let origStartTime = item.originalStartTime || oldItem?.originalStartTime || null
                    let origEndTime = item.originalEndTime || oldItem?.originalEndTime || null

                    // If no originals stored yet and the data actually changed, record the old values
                    if (oldItem && !origCourtId) {
                        const oldDateStr = oldItem.date instanceof Date ? oldItem.date.toISOString().split('T')[0] : String(oldItem.date).split('T')[0]
                        const newDateStr = item.date.split('T')[0]
                        const changed = oldItem.courtId !== item.courtId || oldDateStr !== newDateStr || oldItem.startTime !== item.startTime || oldItem.endTime !== item.endTime
                        if (changed) {
                            origCourtId = oldItem.courtId
                            origDate = oldItem.date
                            origStartTime = oldItem.startTime
                            origEndTime = oldItem.endTime
                        }
                    }

                    return {
                        bookingId,
                        courtId: item.courtId,
                        date: toDateNoonUTC(item.date),
                        startTime: item.startTime,
                        endTime: item.endTime,
                        price: item.price || 0,
                        teacherId: item.teacherId || null,
                        originalCourtId: origCourtId,
                        originalDate: origDate,
                        originalStartTime: origStartTime,
                        originalEndTime: origEndTime,
                    }
                }),
            })

            // Sync teacherId to participants — use the first bookingItem's teacherId
            const assignedTeacherId = updateData.bookingItems.find((item: { teacherId?: string | null }) => item.teacherId)?.teacherId || null
            if (assignedTeacherId) {
                await prisma.participant.updateMany({
                    where: { bookingId },
                    data: { teacherId: assignedTeacherId },
                })
            }
        }

        const updated = await prisma.booking.update({
            where: { id: bookingId },
            data: {
                status: updateData.status || undefined,
                totalAmount: updateData.totalAmount !== undefined ? updateData.totalAmount : undefined,
            },
            include: { bookingItems: { include: { court: true, teacher: true, originalCourt: true } }, participants: true, payments: true, user: { select: { name: true, lineUserId: true } } },
        })

        await prisma.auditLog.create({
            data: {
                userId: user.id, action: 'BOOKING_UPDATE', entityType: 'booking', entityId: bookingId,
                details: JSON.stringify({ bookingNumber: booking.bookingNumber, changes: updateData }),
            },
        })

        publishRealtimeEvent({
            type: updated.status === 'CANCELLED' ? 'booking_cancelled' : 'booking_updated',
            bookingId: updated.id,
            bookingNumber: updated.bookingNumber,
            status: updated.status,
            source: 'admin',
            affectedDates: [...new Set(updated.bookingItems.map(item => item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date).split('T')[0]))],
            courtIds: [...new Set(updated.bookingItems.map(item => item.courtId))],
            message: updated.status === 'CANCELLED' ? 'booking cancelled' : 'booking updated',
        })

        if (updated.user?.lineUserId) {
            const templates = await getLineBookingTemplates()
            const message = renderLineBookingTemplate(templates.update, {
                bookingNumber: updated.bookingNumber,
                customerName: updated.user.name,
                items: updated.bookingItems.map(item => ({
                    courtName: item.court.name,
                    date: formatLineDate(item.date),
                    startTime: item.startTime,
                    endTime: item.endTime,
                    price: item.price,
                })),
                totalAmount: updated.totalAmount,
            }, DEFAULT_LINE_UPDATE_TEMPLATE)

            sendLinePush(updated.user.lineUserId, [{ type: 'text', text: message }]).catch(err => console.error('Failed to send LINE update:', err))
        }

        return NextResponse.json({ booking: updated })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        // Handle unique constraint violation (race condition)
        if (hasCode(error, 'P2002')) {
            return NextResponse.json({ error: 'สนามเวลานี้ถูกจองแล้ว กรุณาลองใหม่' }, { status: 409 })
        }
        console.error('Bookings PATCH error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
