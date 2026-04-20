import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendLineEvaluationRequest } from '@/lib/line-messaging'

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000
const DEFAULT_EVALUATION_DELAY_MINUTES = 5

function getEvaluationDelayMinutes() {
    const value = Number(process.env.EVALUATION_DELAY_MINUTES)
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_EVALUATION_DELAY_MINUTES
}

function getBangkokDateKey(timestampMs: number) {
    return new Date(timestampMs).toISOString().split('T')[0]
}

function formatBangkokMinute(timestampMs: number) {
    return `${getBangkokDateKey(timestampMs)} ${new Date(timestampMs).toISOString().slice(11, 16)}`
}

function getItemEndBangkokTimestamp(date: Date, endTime: string) {
    const [hoursRaw, minutesRaw = '0'] = endTime.split(':')
    const hours = Number(hoursRaw)
    const minutes = Number(minutesRaw)
    const dateKey = date.toISOString().split('T')[0]
    const dayStart = Date.parse(`${dateKey}T00:00:00.000Z`)

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null

    return dayStart + (hours * 60 + minutes) * MINUTE_MS
}

export const dynamic = 'force-dynamic'

// Finds completed booking items and sends evaluation links via LINE.
// If an evaluation link was created earlier when assigning a teacher, reuse that link.
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const now = new Date()
        const bangkokNowMs = now.getTime() + BANGKOK_OFFSET_MS
        const todayStr = getBangkokDateKey(bangkokNowMs)
        const todayDate = new Date(todayStr)
        const evaluationDelayMinutes = getEvaluationDelayMinutes()

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

        const completedItems = bookingItems.filter(item => {
            const itemEndMs = getItemEndBangkokTimestamp(item.date, item.endTime)
            return itemEndMs !== null && itemEndMs + evaluationDelayMinutes * MINUTE_MS <= bangkokNowMs
        })

        let sentCount = 0
        let failedCount = 0
        let evalCreated = 0
        let evalReused = 0
        let skippedNoLine = 0
        let skippedNoTeacher = 0
        let skippedSubmitted = 0
        let itemsMarked = 0
        const sentEvaluationKeys = new Set<string>()
        const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://skibkk.com').replace(/\/$/, '')

        for (const item of completedItems) {
            const booking = item.booking
            const lineUserId = booking.user?.lineUserId

            if (!lineUserId) {
                // No LINE ID: mark as handled to avoid retrying forever.
                await prisma.bookingItem.update({
                    where: { id: item.id },
                    data: { evaluationSent: true },
                })
                skippedNoLine++
                itemsMarked++
                continue
            }

            const teacherIds = new Set<string>()
            const teacherMap = new Map<string, string>()
            for (const participant of booking.participants) {
                if (participant.teacherId && participant.teacher) {
                    teacherIds.add(participant.teacherId)
                    teacherMap.set(participant.teacherId, participant.teacher.name)
                }
            }

            if (teacherIds.size === 0) {
                // Keep evaluationSent=false so it can send after a teacher is assigned later.
                skippedNoTeacher++
                continue
            }

            let itemHandled = true

            for (const teacherId of teacherIds) {
                const sendKey = `${booking.id}:${teacherId}`
                if (sentEvaluationKeys.has(sendKey)) continue

                let evaluation = await prisma.teacherEvaluation.findFirst({
                    where: { bookingId: booking.id, teacherId },
                })

                if (evaluation) {
                    evalReused++
                } else {
                    evaluation = await prisma.teacherEvaluation.create({
                        data: {
                            teacherId,
                            bookingId: booking.id,
                        },
                    })
                    evalCreated++
                }

                if (evaluation.isSubmitted) {
                    skippedSubmitted++
                    continue
                }

                const evaluationUrl = `${baseUrl}/evaluate/${evaluation.token}`
                const itemDate = new Date(item.date).toLocaleDateString('th-TH', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'Asia/Bangkok',
                })

                const result = await sendLineEvaluationRequest(lineUserId, {
                    customerName: booking.user?.name || 'ลูกค้า',
                    teacherName: teacherMap.get(teacherId) || 'ครูผู้สอน',
                    evaluationUrl,
                    courtName: item.court.name,
                    date: itemDate,
                    startTime: item.startTime,
                    endTime: item.endTime,
                })

                if (result.success) {
                    sentCount++
                    sentEvaluationKeys.add(sendKey)
                } else {
                    failedCount++
                    itemHandled = false
                }

                await new Promise(resolve => setTimeout(resolve, 300))
            }

            if (itemHandled) {
                await prisma.bookingItem.update({
                    where: { id: item.id },
                    data: { evaluationSent: true },
                })
                itemsMarked++
            }
        }

        console.log(`Evaluation cron: ${evalCreated} created, ${evalReused} reused, ${sentCount} sent, ${failedCount} failed, ${skippedNoLine} skipped no LINE, ${skippedNoTeacher} skipped no teacher, ${completedItems.length} completed items`)

        return NextResponse.json({
            success: true,
            currentTime: formatBangkokMinute(bangkokNowMs),
            evaluationDelayMinutes,
            completedItems: completedItems.length,
            evaluationsCreated: evalCreated,
            evaluationsReused: evalReused,
            lineMessagesSent: sentCount,
            lineMessagesFailed: failedCount,
            skippedNoLine,
            skippedNoTeacher,
            skippedSubmitted,
            itemsMarked,
        })
    } catch (error) {
        console.error('Evaluation cron error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
