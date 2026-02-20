import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

// Seed endpoint - creates an admin user and sample data
// DELETE THIS FILE BEFORE PRODUCTION DEPLOY
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    try {
        // Action: promote - upgrade a user to ADMIN by email
        if (action === 'promote') {
            const email = searchParams.get('email')
            if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

            const user = await prisma.user.update({
                where: { email },
                data: { role: 'ADMIN' },
            })
            return NextResponse.json({ message: `${user.name} is now ADMIN`, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
        }

        // Action: seed - create sample courts + pricing
        if (action === 'seed') {
            // Create courts
            const courtA = await prisma.court.upsert({
                where: { id: 'court-a' },
                update: {},
                create: {
                    id: 'court-a',
                    name: 'Slope A',
                    description: 'สโลปหลัก สำหรับทุกระดับ',
                    sortOrder: 1,
                },
            })

            const courtB = await prisma.court.upsert({
                where: { id: 'court-b' },
                update: {},
                create: {
                    id: 'court-b',
                    name: 'Slope B',
                    description: 'สโลปสำหรับผู้เริ่มต้น',
                    sortOrder: 2,
                },
            })

            // Create operating hours for both courts (Mon-Sun, 10:00-22:00)
            const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const
            for (const court of [courtA, courtB]) {
                for (const day of days) {
                    await prisma.operatingHours.upsert({
                        where: { courtId_dayOfWeek: { courtId: court.id, dayOfWeek: day } },
                        update: { openTime: '10:00', closeTime: '22:00', isClosed: false },
                        create: { courtId: court.id, dayOfWeek: day, openTime: '10:00', closeTime: '22:00', isClosed: false },
                    })
                }
            }

            // Create pricing rules
            // Weekday: 1,800/hr, Weekend: 2,200/hr
            for (const court of [courtA, courtB]) {
                // Delete existing rules for this court
                await prisma.pricingRule.deleteMany({ where: { courtId: court.id } })

                // Weekday pricing
                await prisma.pricingRule.create({
                    data: {
                        courtId: court.id,
                        daysOfWeek: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
                        startTime: '10:00',
                        endTime: '22:00',
                        price: 1800,
                        priority: 1,
                    },
                })

                // Weekend pricing
                await prisma.pricingRule.create({
                    data: {
                        courtId: court.id,
                        daysOfWeek: ['SATURDAY', 'SUNDAY'],
                        startTime: '10:00',
                        endTime: '22:00',
                        price: 2200,
                        priority: 1,
                    },
                })
            }

            return NextResponse.json({
                message: 'Seed data created!',
                courts: [courtA, courtB],
                operatingHours: '10:00-22:00 ทุกวัน',
                pricing: 'วันธรรมดา ฿1,800/ชม., วันหยุด ฿2,200/ชม.',
            })
        }

        return NextResponse.json({
            usage: {
                promote: '/api/seed?action=promote&email=your@email.com',
                seed: '/api/seed?action=seed',
            },
        })
    } catch (error) {
        console.error('Seed error:', error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
