import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

const normalizeText = (value: string | null | undefined) => value?.trim() || ''

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const user = await requireAuth()

        const rows = await prisma.participant.findMany({
            where: {
                booking: {
                    userId: user.id,
                    status: { not: 'CANCELLED' },
                },
            },
            select: {
                name: true,
                sportType: true,
                age: true,
                shoeSize: true,
                weight: true,
                height: true,
                phone: true,
                isBooker: true,
                booking: { select: { createdAt: true } },
            },
            orderBy: { booking: { createdAt: 'desc' } },
            take: 100,
        })

        const seen = new Set<string>()
        const participants = rows
            .filter(participant => normalizeText(participant.name))
            .map(participant => ({
                name: participant.name,
                sportType: participant.sportType,
                age: participant.age?.toString() || '',
                shoeSize: normalizeText(participant.shoeSize),
                weight: participant.weight?.toString() || '',
                height: participant.height?.toString() || '',
                phone: normalizeText(participant.phone),
                isBooker: participant.isBooker,
                createdAt: participant.booking.createdAt,
            }))
            .filter(participant => {
                const key = [
                    participant.name.toLowerCase().trim(),
                    participant.sportType.toLowerCase().trim(),
                    participant.phone.trim(),
                ].join('|')
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })
            .slice(0, 20)

        return NextResponse.json({ participants })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('GET /api/participants/recent error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
