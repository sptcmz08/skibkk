import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/locks/check?sessionId=xxx
// Returns the earliest expiry for the session's locks (for countdown timer)
export async function GET(req: NextRequest) {
    try {
        const sessionId = req.nextUrl.searchParams.get('sessionId')
        if (!sessionId) return NextResponse.json({ active: false })

        const locks = await prisma.slotLock.findMany({
            where: { sessionId, expiresAt: { gt: new Date() } },
            orderBy: { expiresAt: 'asc' },
        })

        if (!locks.length) return NextResponse.json({ active: false, locks: [] })

        // Earliest expiry = when first lock expires
        const earliest = locks[0].expiresAt
        const secondsLeft = Math.max(0, Math.ceil((earliest.getTime() - Date.now()) / 1000))

        return NextResponse.json({
            active: secondsLeft > 0,
            expiresAt: earliest,
            secondsLeft,
            lockCount: locks.length,
            locks: locks.map(l => ({ courtId: l.courtId, date: l.date, startTime: l.startTime, expiresAt: l.expiresAt })),
        })
    } catch (error) {
        console.error('GET /api/locks/check error:', error)
        return NextResponse.json({ active: false })
    }
}
