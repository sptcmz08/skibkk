import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendLineBookingReminder } from '@/lib/line-messaging'
import { buildLineReminderMessage } from '@/lib/line-booking-notify'

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
    const rangeStartDate = new Date(formatBangkokDateKey(reminderStartMs) + 'T00:00:00.000Z')
    // Use end-of-day so noon-stored @db.Date values are included in the range
    const rangeEndDate = new Date(formatBangkokDateKey(reminderEndMs) + 'T23:59:59.999Z')

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
                    bookingItems: {
                        where: { reminderSentAt: null },
                        include: { court: true },
                        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
                    },
                },
            },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })

    const filtered = candidateItems.filter(item => {
        const itemStartMs = getItemStartBangkokTimestamp(item.date, item.startTime)
        return itemStartMs !== null && itemStartMs >= reminderStartMs && itemStartMs < reminderEndMs
    })

    console.log(`[Reminders] Found ${filtered.length} items in window ${formatBangkokMinute(reminderStartMs)} - ${formatBangkokMinute(reminderEndMs)}`)
    return filtered
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

function getDateKey(date: Date) {
    return date.toISOString().split('T')[0]
}

/**
 * Collect ALL unsent items for a booking (across all courts/dates),
 * not just those in the current reminder window.
 * This ensures 1 booking = 1 LINE message.
 */
function collectAllUnsentBookingItems(dueItems: DueReminderItem[]): DueReminderItem[] {
    if (dueItems.length === 0) return []
    const representative = dueItems[0]
    const allUnsent = [...representative.booking.bookingItems]
        .filter(item => item.reminderSentAt === null)
        .sort((a, b) => {
            const dateCompare = getDateKey(a.date).localeCompare(getDateKey(b.date))
            if (dateCompare !== 0) return dateCompare
            return a.startTime.localeCompare(b.startTime)
        })
        .map(item => ({ ...item, booking: representative.booking }))
    return allUnsent.length > 0 ? allUnsent : dueItems
}

function buildReminderMessageItems(items: DueReminderItem[]) {
    const sortedItems = [...items].sort((a, b) => {
        const dateCompare = getDateKey(a.date).localeCompare(getDateKey(b.date))
        if (dateCompare !== 0) return dateCompare
        if (a.court.name !== b.court.name) return a.court.name.localeCompare(b.court.name)
        return a.startTime.localeCompare(b.startTime)
    })

    const groupedItems = new Map<string, DueReminderItem[]>()
    for (const item of sortedItems) {
        const dateLabel = new Date(item.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
        const key = `${item.courtId}_${dateLabel}`
        const group = groupedItems.get(key) || []
        group.push(item)
        groupedItems.set(key, group)
    }

    return [...groupedItems.values()].map(group => {
        const first = group[0]
        return {
            courtName: first.court.name,
            date: new Date(first.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
            startTime: first.startTime,
            endTime: group[group.length - 1].endTime,
            price: group.reduce((sum, item) => sum + item.price, 0),
            timeRanges: group.length > 1
                ? group.map(item => ({ startTime: item.startTime, endTime: item.endTime }))
                : undefined,
        }
    })
}

/**
 * Process a group of reminder bookings: send LINE messages and mark as sent.
 */
async function processReminderGroup(
    itemsByBooking: Map<string, DueReminderItem[]>,
    now: Date,
    reminderTemplate: string | undefined,
    headerText: string,
    messageType: string,
) {
    let sentCount = 0
    let failCount = 0
    let skippedCount = 0
    let reminderItemsMarked = 0

    console.log(`[Reminders] Processing ${itemsByBooking.size} bookings for ${messageType}`)

    for (const [bookingId, dueItems] of itemsByBooking.entries()) {
        // Collect ALL unsent items for this booking (not just window items)
        // so that 1 booking = 1 LINE message with complete info
        const allItems = collectAllUnsentBookingItems(dueItems)
        const itemIds = allItems.map(item => item.id)
        const booking = allItems[0].booking

        console.log(`[Reminders] Booking ${bookingId}: ${allItems.length} items - ${allItems.map(i => `${i.court.name} ${i.startTime}-${i.endTime}`).join(', ')}`)

        if (!booking.user?.lineUserId) {
            skippedCount++
            await prisma.bookingItem.updateMany({
                where: { id: { in: itemIds } },
                data: { reminderSentAt: now },
            })
            reminderItemsMarked += itemIds.length
            continue
        }

        const message = buildLineReminderMessage(reminderTemplate, {
            bookingNumber: booking.bookingNumber,
            customerName: booking.user.name,
            items: buildReminderMessageItems(allItems),
            totalAmount: booking.totalAmount,
        }, headerText)

        // Double-check: verify at least some items are still unsent before sending
        const stillUnsent = await prisma.bookingItem.count({
            where: { id: { in: itemIds }, reminderSentAt: null }
        })
        if (stillUnsent === 0) {
            console.log(`[Reminders] Booking ${bookingId}: all items already sent, skipping`)
            skippedCount++
            continue
        }

        const result = await sendLineBookingReminder(booking.user.lineUserId, message, { messageType, bookingId: booking.id })

        if (result.success) {
            sentCount++
            // Mark ALL unsent items of this booking as sent atomically
            await prisma.$transaction(async (tx) => {
                await tx.bookingItem.updateMany({
                    where: { id: { in: itemIds }, reminderSentAt: null },
                    data: { reminderSentAt: now },
                })
            })
            reminderItemsMarked += itemIds.length
            console.log(`[Reminders] Booking ${bookingId}: sent successfully (${allItems.length} items in 1 message)`)
        } else {
            failCount++
            console.log(`[Reminders] Booking ${bookingId}: failed to send - ${result.error}`)
        }

        await new Promise(resolve => setTimeout(resolve, 300))
    }

    return { sentCount, failCount, skippedCount, reminderItemsMarked }
}

// Call this endpoint frequently by cron. It sends LINE reminders for booking items
// that start about 24 hours from now, within REMINDER_WINDOW_MINUTES.
// It also sends same-day reminders for bookings starting 1–12 hours from now.
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

        // 24h-ahead reminder window
        const reminderStartMs = bangkokNowMs + MS_PER_DAY
        const reminderEndMs = reminderStartMs + windowMinutes * 60 * 1000
        const dueItems = await findDueReminderItems(reminderStartMs, reminderEndMs)
        const itemsByBooking = groupItemsByBooking(dueItems)

        // Same-day catch-up: bookings starting 1h to 12h from now
        // This covers bookings made less than 24h in advance
        const SAME_DAY_MIN_MS = 1 * 60 * 60 * 1000
        const SAME_DAY_MAX_MS = 12 * 60 * 60 * 1000
        const sameDayStartMs = bangkokNowMs + SAME_DAY_MIN_MS
        const sameDayEndMs = bangkokNowMs + SAME_DAY_MAX_MS
        const sameDayItems = await findDueReminderItems(sameDayStartMs, sameDayEndMs)
        const sameDayByBooking = groupItemsByBooking(sameDayItems)

        // Fetch custom template
        const settings = await prisma.siteSetting.findMany()
        const settingsMap: Record<string, string> = {}
        settings.forEach(s => settingsMap[s.key] = s.value)
        const reminderTemplate = settingsMap['line_booking_reminder_template']

        // Process 24h-ahead reminders ("พรุ่งนี้")
        const result24h = await processReminderGroup(
            itemsByBooking, now, reminderTemplate,
            '📅 แจ้งเตือน: คุณมีจองสนามพรุ่งนี้!', 'reminder',
        )

        // Process same-day reminders ("วันนี้")
        const resultSameDay = await processReminderGroup(
            sameDayByBooking, now, reminderTemplate,
            '⏰ แจ้งเตือน: คุณมีจองสนามวันนี้!', 'reminder_sameday',
        )

        const totalSent = result24h.sentCount + resultSameDay.sentCount
        const totalFailed = result24h.failCount + resultSameDay.failCount
        const totalSkipped = result24h.skippedCount + resultSameDay.skippedCount
        const totalItemsMarked = result24h.reminderItemsMarked + resultSameDay.reminderItemsMarked

        console.log(`LINE Reminder cron: ${totalSent} sent (24h:${result24h.sentCount} sameDay:${resultSameDay.sentCount}), ${totalFailed} failed, ${totalSkipped} skipped (no LINE), ${dueItems.length + sameDayItems.length} due items`)

        return NextResponse.json({
            success: true,
            currentTime: formatBangkokMinute(bangkokNowMs),
            reminderWindow: {
                start: formatBangkokMinute(reminderStartMs),
                end: formatBangkokMinute(reminderEndMs),
                minutes: windowMinutes,
            },
            sameDayWindow: {
                start: formatBangkokMinute(sameDayStartMs),
                end: formatBangkokMinute(sameDayEndMs),
            },
            totalBookings: itemsByBooking.size + sameDayByBooking.size,
            totalItems: dueItems.length + sameDayItems.length,
            lineMessagesSent: totalSent,
            lineMessagesSent24h: result24h.sentCount,
            lineMessagesSentSameDay: resultSameDay.sentCount,
            lineMessagesFailed: totalFailed,
            skippedNoLine: totalSkipped,
            reminderItemsMarked: totalItemsMarked,
        })
    } catch (error) {
        console.error('Reminder cron error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
