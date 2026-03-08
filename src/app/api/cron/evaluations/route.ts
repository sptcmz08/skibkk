import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendLineEvaluationRequest } from '@/lib/line-messaging'

// Cron endpoint — runs every 30 minutes
// Finds completed booking items and sends evaluation links via LINE

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Current time in Bangkok (UTC+7)
        const now = new Date()
        const bangkokOffset = 7 * 60 * 60 * 1000
        const bangkokNow = new Date(now.getTime() + bangkokOffset)
        const currentHHMM = `${String(bangkokNow.getUTCHours()).padStart(2, '0')}:${String(bangkokNow.getUTCMinutes()).padStart(2, '0')}`
        const todayStr = bangkokNow.toISOString().split('T')[0]
        const todayDate = new Date(todayStr)

        // Find BookingItems where:
        // 1. date is today (or earlier)
        // 2. endTime has passed (endTime <= current time)
        // 3. evaluationSent = false
        // 4. booking is CONFIRMED
        const bookingItems = await prisma.bookingItem.findMany({
            where: {
                evaluationSent: false,
                date: { lte: todayDate },
                booking: {
                    status: 'CONFIRMED',
                },
            },
            include: {
                booking: {
                    include: {
                        user: { select: { name: true, lineUserId: true } },
                        participants: {
                            where: { teacherId: { not: null } },
                            include: { teacher: { select: { id: true, name: true } } },
                        },
                    },
                },
                court: { select: { name: true } },
            },
        })

        // Filter by endTime (string comparison works for HH:MM format)
        const completedItems = bookingItems.filter(item => {
            const itemDateStr = new Date(item.date).toISOString().split('T')[0]
            // If item date is before today, it's definitely completed
            if (itemDateStr < todayStr) return true
            // If item date is today, check if endTime has passed
            return item.endTime <= currentHHMM
        })

        let sentCount = 0
        let evalCreated = 0
        let skippedCount = 0
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://skibkk.com'

        for (const item of completedItems) {
            const booking = item.booking
            const lineUserId = booking.user?.lineUserId

            if (!lineUserId) {
                // No LINE ID — still mark as sent to avoid retrying
                await prisma.bookingItem.update({
                    where: { id: item.id },
                    data: { evaluationSent: true },
                })
                skippedCount++
                continue
            }

            // Get unique teachers from participants
            const teacherIds = new Set<string>()
            const teacherMap = new Map<string, string>()
            for (const p of booking.participants) {
                if (p.teacherId && p.teacher) {
                    teacherIds.add(p.teacherId)
                    teacherMap.set(p.teacherId, p.teacher.name)
                }
            }

            if (teacherIds.size === 0) {
                // No teachers assigned — mark as sent
                await prisma.bookingItem.update({
                    where: { id: item.id },
                    data: { evaluationSent: true },
                })
                skippedCount++
                continue
            }

            // Create evaluation for each teacher (if not already created for this booking+teacher)
            for (const teacherId of teacherIds) {
                // Check if evaluation already exists for this booking + teacher
                const existing = await prisma.teacherEvaluation.findFirst({
                    where: { bookingId: booking.id, teacherId },
                })
                if (existing) continue

                // Create evaluation token
                const evaluation = await prisma.teacherEvaluation.create({
                    data: {
                        teacherId,
                        bookingId: booking.id,
                    },
                })

                const evaluationUrl = `${baseUrl}/evaluate/${evaluation.token}`
                const itemDate = new Date(item.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

                // Send LINE message
                const result = await sendLineEvaluationRequest(lineUserId, {
                    customerName: booking.user?.name || 'ลูกค้า',
                    teacherName: teacherMap.get(teacherId) || 'ครูผู้สอน',
                    evaluationUrl,
                    courtName: item.court.name,
                    date: itemDate,
                    startTime: item.startTime,
                    endTime: item.endTime,
                })

                evalCreated++
                if (result.success) sentCount++

                // Small delay to avoid LINE rate limiting
                await new Promise(resolve => setTimeout(resolve, 300))
            }

            // Mark booking item as evaluation sent
            await prisma.bookingItem.update({
                where: { id: item.id },
                data: { evaluationSent: true },
            })
        }

        console.log(`⭐ Evaluation cron: ${evalCreated} evaluations created, ${sentCount} LINE messages sent, ${skippedCount} skipped, ${completedItems.length} completed items`)

        return NextResponse.json({
            success: true,
            currentTime: currentHHMM,
            completedItems: completedItems.length,
            evaluationsCreated: evalCreated,
            lineMessagesSent: sentCount,
            skipped: skippedCount,
        })
    } catch (error) {
        console.error('Evaluation cron error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
