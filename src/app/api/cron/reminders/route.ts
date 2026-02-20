import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendBookingReminder } from '@/lib/mailer'

// This endpoint should be called daily by a cron job (e.g., Vercel Cron)
// It sends reminder emails for bookings that are scheduled for TOMORROW
// Bookings made for the same day do NOT receive a reminder

export async function GET(req: NextRequest) {
    // Simple auth via secret header to prevent unauthorized access
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'skibkk-cron-2026'
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Calculate tomorrow's date (Thailand timezone UTC+7)
        const now = new Date()
        const bangkokOffset = 7 * 60 * 60 * 1000
        const bangkokNow = new Date(now.getTime() + bangkokOffset)
        const tomorrow = new Date(bangkokNow)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowDate = new Date(tomorrow.toISOString().split('T')[0]) // midnight UTC of tomorrow

        // Find all CONFIRMED or PENDING bookings that have items scheduled for tomorrow
        const bookings = await prisma.booking.findMany({
            where: {
                status: { in: ['CONFIRMED', 'PENDING'] },
                bookingItems: {
                    some: {
                        date: tomorrowDate,
                    },
                },
            },
            include: {
                user: { select: { email: true, name: true } },
                bookingItems: {
                    where: { date: tomorrowDate },
                    include: { court: true },
                },
            },
        })

        let sentCount = 0
        let failCount = 0

        for (const booking of bookings) {
            if (!booking.user?.email) continue

            const result = await sendBookingReminder(booking.user.email, {
                bookingNumber: booking.bookingNumber,
                customerName: booking.user.name,
                items: booking.bookingItems.map(item => ({
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
            } else {
                failCount++
            }

            // Small delay between emails to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        console.log(`📧 Reminder cron: ${sentCount} sent, ${failCount} failed, ${bookings.length} total bookings for tomorrow`)

        return NextResponse.json({
            success: true,
            date: tomorrowDate.toISOString().split('T')[0],
            totalBookings: bookings.length,
            emailsSent: sentCount,
            emailsFailed: failCount,
        })
    } catch (error) {
        console.error('Reminder cron error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
