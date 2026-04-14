import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendLineBookingReminder } from '@/lib/line-messaging'

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000
const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_WINDOW_MINUTES = 30

type DueReminderItem = Awaited<ReturnType<typeof findDueReminderItems>>[number]

function getReminderWindowMinutes() {
    const value = Number(process.env.REMINDER_WINDOW_MINUTES)
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_WINDOW_MINUTES
}

function formatBangkokDateKey(timestampMs: number) {
    return new Date(timestampMs).toISOString().split('T')[0]
}

function formatBangkokMinute(timestampMs: number) {
    return `${formatBangkokDateKey(timestampMs)} ${new Date(timestampMs).toISOString().slice(11, 16)}`
}

function getItemStartBangkokTimestamp(date: Date, startTime: string) {
    const [hoursRaw, minutesRaw = '0'] = startTime.split(':')
    const hours = Number(hoursRaw)
    const minutes = Number(minutesRaw)
    const dateKey = date.toISOString().split('T')[0]
    const dayStart = Date.parse(`${dateKey}T00:00:00.000Z`)

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null

    return dayStart + (hours * 60 + minutes) * 60 * 1000
}

async function findDueReminderItems(reminderStartMs: number, reminderEndMs: number) {
    const rangeStartDate = new Date(formatBangkokDateKey(reminderStartMs))
    const rangeEndDate = new Date(formatBangkokDateKey(reminderEndMs))

    const candidateItems = await prisma.bookingItem.findMany({
        where: {
            reminderSentAt: null,
            date: {
                gte: rangeStartDate,
                lte: rangeEndDate,
            },
            booking: {
                status: { in: ['CONFIRMED', 'PENDING'] },
            },
        },
        include: {
            court: true,
            booking: {
                include: {
                    user: { select: { name: true, email: true, lineUserId: true } },
                },
            },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })

    return candidateItems.filter(item => {
        const itemStartMs = getItemStartBangkokTimestamp(item.date, item.startTime)
        return itemStartMs !== null && itemStartMs >= reminderStartMs && itemStartMs < reminderEndMs
    })
}

function groupItemsByBooking(items: DueReminderItem[]) {
    const itemsByBooking = new Map<string, DueReminderItem[]>()
    for (const item of items) {
        const group = itemsByBooking.get(item.bookingId) || []
        group.push(item)
        itemsByBooking.set(item.bookingId, group)
    }
    return itemsByBooking
}

// Call this endpoint frequently by cron. It sends LINE reminders for booking items
// that start about 24 hours from now, within REMINDER_WINDOW_MINUTES.
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const now = new Date()
        const bangkokNowMs = now.getTime() + BANGKOK_OFFSET_MS
        const windowMinutes = getReminderWindowMinutes()
        const reminderStartMs = bangkokNowMs + MS_PER_DAY
        const reminderEndMs = reminderStartMs + windowMinutes * 60 * 1000
        const dueItems = await findDueReminderItems(reminderStartMs, reminderEndMs)
        const itemsByBooking = groupItemsByBooking(dueItems)

        let sentCount = 0
        let failCount = 0
        let skippedCount = 0
        let reminderItemsMarked = 0

        for (const items of itemsByBooking.values()) {
            const booking = items[0].booking
            const itemIds = items.map(item => item.id)

            if (!booking.user?.lineUserId) {
                skippedCount++
                await prisma.bookingItem.updateMany({
                    where: { id: { in: itemIds } },
                    data: { reminderSentAt: now },
                })
                reminderItemsMarked += itemIds.length
                continue
            }

            const result = await sendLineBookingReminder(booking.user.lineUserId, {
                bookingNumber: booking.bookingNumber,
                customerName: booking.user.name,
                items: items.map(item => ({
                    courtName: item.court.name,
                    date: new Date(item.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
                    startTime: item.startTime,
                    endTime: item.endTime,
                    price: item.price,
                })),
                totalAmount: booking.totalAmount,
            })

            if (result.success) {
                sentCount++
                await prisma.bookingItem.updateMany({
                    where: { id: { in: itemIds } },
                    data: { reminderSentAt: now },
                })
                reminderItemsMarked += itemIds.length
            } else {
                failCount++
            }

            await new Promise(resolve => setTimeout(resolve, 300))
        }

        console.log(`LINE Reminder cron: ${sentCount} sent, ${failCount} failed, ${skippedCount} skipped (no LINE), ${dueItems.length} due items`)

        return NextResponse.json({
            success: true,
            currentTime: formatBangkokMinute(bangkokNowMs),
            reminderWindow: {
                start: formatBangkokMinute(reminderStartMs),
                end: formatBangkokMinute(reminderEndMs),
                minutes: windowMinutes,
            },
            totalBookings: itemsByBooking.size,
            totalItems: dueItems.length,
            lineMessagesSent: sentCount,
            lineMessagesFailed: failCount,
            skippedNoLine: skippedCount,
            reminderItemsMarked,
        })
    } catch (error) {
        console.error('Reminder cron error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
