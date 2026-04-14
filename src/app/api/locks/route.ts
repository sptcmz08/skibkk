import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publishRealtimeEvent } from '@/lib/realtime-events'
import { getAuditRequestMeta } from '@/lib/audit'

const LOCK_DURATION_MS = 20 * 60 * 1000 // 20 minutes

// POST /api/locks — lock one or more slots for a session
// DELETE /api/locks — release all locks for a session
export async function POST(req: NextRequest) {
    try {
        const requestMeta = getAuditRequestMeta(req)
        const { sessionId, slots } = await req.json() as {
            sessionId: string
            slots: { courtId: string; date: string; startTime: string }[]
        }
        if (!sessionId || !slots?.length) {
            return NextResponse.json({ error: 'sessionId and slots required' }, { status: 400 })
        }

        const newExpiresAt = new Date(Date.now() + LOCK_DURATION_MS)
        const results = []
        const changedSlots: { courtId: string; date: string }[] = []

        for (const slot of slots) {
            try {
                // Check if slot is already locked
                const existing = await prisma.slotLock.findUnique({
                    where: { courtId_date_startTime: { courtId: slot.courtId, date: slot.date, startTime: slot.startTime } },
                })

                if (existing && existing.expiresAt > new Date()) {
                    if (existing.sessionId !== sessionId) {
                        // Locked by another session — conflict
                        const secondsLeft = Math.ceil((existing.expiresAt.getTime() - Date.now()) / 1000)
                        results.push({ ...slot, success: false, reason: 'locked_by_other', secondsLeft })
                        continue
                    }
                    // Same session — keep existing expiry (don't reset timer!)
                    results.push({ ...slot, success: true, expiresAt: existing.expiresAt })
                    continue
                }

                // New lock or expired lock — create with fresh 20-minute expiry
                await prisma.slotLock.upsert({
                    where: { courtId_date_startTime: { courtId: slot.courtId, date: slot.date, startTime: slot.startTime } },
                    update: { sessionId, expiresAt: newExpiresAt },
                    create: { courtId: slot.courtId, date: slot.date, startTime: slot.startTime, sessionId, expiresAt: newExpiresAt },
                })
                changedSlots.push({ courtId: slot.courtId, date: slot.date })
                results.push({ ...slot, success: true, expiresAt: newExpiresAt })
            } catch {
                results.push({ ...slot, success: false, reason: 'error' })
            }
        }

        // Cleanup expired locks and log as failures
        const expiredLocks = await prisma.slotLock.findMany({ where: { expiresAt: { lt: new Date() } } })
        if (expiredLocks.length > 0) {
            for (const lock of expiredLocks) {
                await prisma.auditLog.create({
                    data: {
                        userId: null, action: 'BOOKING_FAIL', entityType: 'lock', entityId: lock.id,
                        ipAddress: requestMeta.ipAddress,
                        details: JSON.stringify({
                            reason: 'ไม่ทำภายในเวลาที่กำหนด',
                            sessionId: lock.sessionId,
                            courtId: lock.courtId,
                            date: lock.date,
                            startTime: lock.startTime,
                            request: requestMeta,
                        }),
                    },
                }).catch(() => { })
            }
            await prisma.slotLock.deleteMany({ where: { expiresAt: { lt: new Date() } } })
        }

        // Return the earliest expiresAt from successful locks
        const expiries = results
            .filter(r => r.success && 'expiresAt' in r)
            .map(r => (r as { expiresAt: Date }).expiresAt)
        const earliestExpiry = expiries.length > 0
            ? expiries.reduce((min, e) => e < min ? e : min, expiries[0])
            : null

        if (changedSlots.length > 0) {
            publishRealtimeEvent({
                type: 'lock_changed',
                source: 'system',
                sessionId,
                affectedDates: [...new Set(changedSlots.map(slot => slot.date))],
                courtIds: [...new Set(changedSlots.map(slot => slot.courtId))],
                message: 'slot locked',
            })
        }

        return NextResponse.json({ results, expiresAt: earliestExpiry })
    } catch (error) {
        console.error('POST /api/locks error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { sessionId, slots } = await req.json() as {
            sessionId: string
            slots?: { courtId: string; date: string; startTime: string }[]
        }
        if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

        const changedSlots: { courtId: string; date: string }[] = []

        if (slots?.length) {
            // Release specific slots
            for (const slot of slots) {
                await prisma.slotLock.deleteMany({
                    where: { courtId: slot.courtId, date: slot.date, startTime: slot.startTime, sessionId },
                })
                changedSlots.push({ courtId: slot.courtId, date: slot.date })
            }
        } else {
            // Release all locks for this session
            const existingLocks = await prisma.slotLock.findMany({
                where: { sessionId },
                select: { courtId: true, date: true },
            })
            await prisma.slotLock.deleteMany({ where: { sessionId } })
            changedSlots.push(...existingLocks)
        }

        if (changedSlots.length > 0) {
            publishRealtimeEvent({
                type: 'lock_changed',
                source: 'system',
                sessionId,
                affectedDates: [...new Set(changedSlots.map(slot => slot.date))],
                courtIds: [...new Set(changedSlots.map(slot => slot.courtId))],
                message: 'slot released',
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('DELETE /api/locks error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
