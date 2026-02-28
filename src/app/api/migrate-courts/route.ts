import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

// One-time migration: set venueId on courts based on sportType (venue name match)
export async function POST() {
    try {
        await requireAdmin()

        const venues = await prisma.venue.findMany()
        const courts = await prisma.court.findMany()

        let updated = 0
        const results: Array<{ court: string; venue: string; matched: boolean }> = []

        for (const court of courts) {
            // Skip courts that already have venueId
            if (court.venueId) {
                results.push({ court: court.name, venue: 'already set', matched: true })
                continue
            }

            // Match sportType (venue name) to venue id
            const matchedVenue = venues.find(v =>
                court.sportType && v.name.toLowerCase().includes(court.sportType.toLowerCase())
                || court.sportType && court.sportType.toLowerCase().includes(v.name.toLowerCase())
            )

            if (matchedVenue) {
                await prisma.court.update({
                    where: { id: court.id },
                    data: { venueId: matchedVenue.id },
                })
                updated++
                results.push({ court: court.name, venue: matchedVenue.name, matched: true })
            } else {
                results.push({ court: court.name, venue: court.sportType || 'none', matched: false })
            }
        }

        return NextResponse.json({
            message: `Updated ${updated} courts`,
            total: courts.length,
            results,
        })
    } catch (error) {
        if ((error as Error).message === 'Forbidden') {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }
        console.error('Migration error:', error)
        return NextResponse.json({ error: (error as Error).message }, { status: 500 })
    }
}
