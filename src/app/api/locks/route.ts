import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const LOCK_DURATION_MS = 20 * 60 * 1000 // 20 minutes

// POST /api/locks — lock one or more slots for a session
// DELETE /api/locks — release all locks for a session
export async function POST(req: NextRequest) {
    try {
        const { sessionId, slots } = await req.json() as {
            sessionId: string
            slots: { courtId: string; date: string; startTime: string }[]
        }
        if (!sessionId || !slots?.length) {
            return NextResponse.json({ error: 'sessionId and slots required' }, { status: 400 })
        }

        const expiresAt = new Date(Date.now() + LOCK_DURATION_MS)
        const results = []

        for (const slot of slots) {
            try {
                // Check if slot is already locked by another session
                const existing = await prisma.slotLock.findUnique({
                    where: { courtId_date_startTime: { courtId: slot.courtId, date: slot.date, startTime: slot.startTime } },
                })

                if (existing && existing.sessionId !== sessionId && existing.expiresAt > new Date()) {
                    const secondsLeft = Math.ceil((existing.expiresAt.getTime() - Date.now()) / 1000)
                    results.push({ ...slot, success: false, reason: 'locked_by_other', secondsLeft })
                    continue
                }

                // Upsert lock (create or refresh expiry for same session)
                await prisma.slotLock.upsert({
                    where: { courtId_date_startTime: { courtId: slot.courtId, date: slot.date, startTime: slot.startTime } },
                    update: { sessionId, expiresAt },
                    create: { courtId: slot.courtId, date: slot.date, startTime: slot.startTime, sessionId, expiresAt },
                })
                results.push({ ...slot, success: true, expiresAt })
            } catch {
                results.push({ ...slot, success: false, reason: 'error' })
            }
        }

        // Cleanup expired locks while we're here
        await prisma.slotLock.deleteMany({ where: { expiresAt: { lt: new Date() } } })

        return NextResponse.json({ results, expiresAt })
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

        if (slots?.length) {
            // Release specific slots
            for (const slot of slots) {
                await prisma.slotLock.deleteMany({
                    where: { courtId: slot.courtId, date: slot.date, startTime: slot.startTime, sessionId },
                })
            }
        } else {
            // Release all locks for this session
            await prisma.slotLock.deleteMany({ where: { sessionId } })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('DELETE /api/locks error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
