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

type EvaluationCronItem = Awaited<ReturnType<typeof findEvaluationCronItems>>[number]

async function findEvaluationCronItems(todayDate: Date, evaluationSent?: boolean) {
    return prisma.bookingItem.findMany({
        where: {
            ...(evaluationSent === undefined ? {} : { evaluationSent }),
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
            teacher: { select: { id: true, name: true } },
        },
    })
}

function getItemTeacherIds(item: EvaluationCronItem) {
    const teacherIds = new Set<string>()
    const teacherMap = new Map<string, string>()

    if (item.teacherId && item.teacher) {
        teacherIds.add(item.teacherId)
        teacherMap.set(item.teacherId, item.teacher.name)
    } else {
        for (const participant of item.booking.participants) {
            if (participant.teacherId && participant.teacher) {
                teacherIds.add(participant.teacherId)
                teacherMap.set(participant.teacherId, participant.teacher.name)
            }
        }
    }

    return { teacherIds, teacherMap }
}

function isItemDue(item: EvaluationCronItem, evaluationDelayMinutes: number, bangkokNowMs: number) {
    const itemEndMs = getItemEndBangkokTimestamp(item.date, item.endTime)
    return itemEndMs !== null && itemEndMs + evaluationDelayMinutes * MINUTE_MS <= bangkokNowMs
}

function maskLineUserId(lineUserId: string) {
    return `${lineUserId.slice(0, 5)}...${lineUserId.slice(-4)}`
}

async function buildDebugPayload(todayDate: Date, evaluationDelayMinutes: number, bangkokNowMs: number) {
    const allCandidateItems = await findEvaluationCronItems(todayDate)
    const completedItems = allCandidateItems.filter(item => isItemDue(item, evaluationDelayMinutes, bangkokNowMs))

    const debugItems = await Promise.all(completedItems.slice(0, 30).map(async item => {
        const lineUserId = item.booking.user?.lineUserId || null
        const { teacherIds } = getItemTeacherIds(item)
        const evaluations = teacherIds.size > 0
            ? await prisma.teacherEvaluation.findMany({
                where: { bookingItemId: item.id, teacherId: { in: [...teacherIds] } },
                select: { isSubmitted: true },
            })
            : []

        let reason = 'ready'
        if (item.evaluationSent) reason = 'already_marked_sent'
        else if (!lineUserId) reason = 'no_line_user_id'
        else if (teacherIds.size === 0) reason = 'no_teacher'
        else if (evaluations.some(evaluation => evaluation.isSubmitted)) reason = 'already_submitted'

        return {
            bookingNumber: item.booking.bookingNumber,
            bookingItemId: item.id,
            courtName: item.court.name,
            date: item.date.toISOString().split('T')[0],
            startTime: item.startTime,
            endTime: item.endTime,
            evaluationSent: item.evaluationSent,
            hasLineUserId: Boolean(lineUserId),
            teacherCount: teacherIds.size,
            evaluationCount: evaluations.length,
            reason,
        }
    }))

    const recentEvaluationLogs = await prisma.lineMessageLog.findMany({
        where: { messageType: 'evaluation' },
        orderBy: { sentAt: 'desc' },
        take: 10,
        select: {
            sentAt: true,
            lineUserId: true,
            bookingId: true,
            success: true,
            httpStatus: true,
            errorCode: true,
            errorDetail: true,
        },
    })

    return {
        candidateItems: allCandidateItems.length,
        completedItems: completedItems.length,
        pendingCompletedItems: completedItems.filter(item => !item.evaluationSent).length,
        alreadyMarkedCompletedItems: completedItems.filter(item => item.evaluationSent).length,
        items: debugItems,
        recentEvaluationLogs: recentEvaluationLogs.map(log => ({
            ...log,
            lineUserId: maskLineUserId(log.lineUserId),
        })),
    }
}

// Finds completed booking items and sends one evaluation link per booking slot via LINE.
// If a slot-level evaluation link was created earlier when assigning a teacher, reuse it.
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const includeDebug = searchParams.get('debug') === '1'
        const now = new Date()
        const bangkokNowMs = now.getTime() + BANGKOK_OFFSET_MS
        const todayStr = getBangkokDateKey(bangkokNowMs)
        const todayDate = new Date(todayStr + 'T23:59:59Z')
        const evaluationDelayMinutes = getEvaluationDelayMinutes()

        const bookingItems = await findEvaluationCronItems(todayDate, false)

        const completedItems = bookingItems.filter(item => isItemDue(item, evaluationDelayMinutes, bangkokNowMs))

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
                // Keep evaluationSent=false so it can send after LINE is linked later.
                skippedNoLine++
                continue
            }

            const { teacherIds, teacherMap } = getItemTeacherIds(item)

            if (teacherIds.size === 0) {
                // Keep evaluationSent=false so it can send after a teacher is assigned later.
                skippedNoTeacher++
                continue
            }

            let itemHandled = true

            for (const teacherId of teacherIds) {
                const sendKey = `${item.id}:${teacherId}`
                if (sentEvaluationKeys.has(sendKey)) continue

                let evaluation = await prisma.teacherEvaluation.findFirst({
                    where: { bookingItemId: item.id, teacherId },
                })

                if (evaluation) {
                    evalReused++
                } else {
                    evaluation = await prisma.teacherEvaluation.create({
                        data: {
                            teacherId,
                            bookingId: booking.id,
                            bookingItemId: item.id,
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
                    bookingId: booking.id,
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

        const debugPayload = includeDebug ? await buildDebugPayload(todayDate, evaluationDelayMinutes, bangkokNowMs) : undefined

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
            ...(debugPayload ? { debug: debugPayload } : {}),
        })
    } catch (error) {
        console.error('Evaluation cron error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
