import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Seed endpoint - creates initial courts and sample data
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

        // Action: seed - create courts with operating hours & pricing
        if (action === 'seed') {
            const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const

            // ── Define all courts ──────────────────────────────────────────────
            const COURTS = [
                // สกี้
                { id: 'ski-a', name: 'สโลป สกี้ A', description: 'สโลปสกี้สายหลัก เหมาะสำหรับทุกระดับ', sportType: 'สกี้', sortOrder: 1 },
                { id: 'ski-b', name: 'สโลป สกี้ B', description: 'สโลปสกี้ขั้นกลาง-สูง ความชันสูง', sportType: 'สกี้', sortOrder: 2 },
                { id: 'ski-c', name: 'สโลป สกี้ C', description: 'สโลปสกี้สำหรับผู้เริ่มต้น ความชันน้อย', sportType: 'สกี้', sortOrder: 3 },
                // สโนบอร์ด
                { id: 'snow-a', name: 'สโลป สโนบอร์ด A', description: 'สโลปสโนบอร์ดสายหลัก เหมาะสำหรับทุกระดับ', sportType: 'สโนบอร์ด', sortOrder: 4 },
                { id: 'snow-b', name: 'สโลป สโนบอร์ด B', description: 'สโลปสโนบอร์ดขั้นกลาง มี Halfpipe', sportType: 'สโนบอร์ด', sortOrder: 5 },
                { id: 'snow-c', name: 'สโลป สโนบอร์ด C', description: 'สโลปสโนบอร์ดสำหรับผู้เริ่มต้น', sportType: 'สโนบอร์ด', sortOrder: 6 },
            ]

            const createdCourts = []

            for (const c of COURTS) {
                const court = await prisma.court.upsert({
                    where: { id: c.id },
                    update: { name: c.name, description: c.description, sportType: c.sportType, sortOrder: c.sortOrder },
                    create: { id: c.id, name: c.name, description: c.description, sportType: c.sportType, sortOrder: c.sortOrder },
                })

                // Operating hours: 08:00–23:00 every day
                for (const day of DAYS) {
                    await prisma.operatingHours.upsert({
                        where: { courtId_dayOfWeek: { courtId: court.id, dayOfWeek: day } },
                        update: { openTime: '08:00', closeTime: '23:00', isClosed: false },
                        create: { courtId: court.id, dayOfWeek: day, openTime: '08:00', closeTime: '23:00', isClosed: false },
                    })
                }

                // Pricing rules (clear old ones first)
                await prisma.pricingRule.deleteMany({ where: { courtId: court.id } })

                // Weekday: ฿1,800/hr
                await prisma.pricingRule.create({
                    data: {
                        courtId: court.id,
                        daysOfWeek: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
                        startTime: '08:00', endTime: '23:00', price: 1800, priority: 1,
                    },
                })

                // Weekend: ฿2,200/hr
                await prisma.pricingRule.create({
                    data: {
                        courtId: court.id,
                        daysOfWeek: ['SATURDAY', 'SUNDAY'],
                        startTime: '08:00', endTime: '23:00', price: 2200, priority: 1,
                    },
                })

                createdCourts.push({ id: court.id, name: court.name, sportType: court.sportType })
            }

            return NextResponse.json({
                message: `Seed complete! สร้าง ${createdCourts.length} สนาม`,
                courts: createdCourts,
                operatingHours: '08:00–23:00 ทุกวัน',
                pricing: 'วันธรรมดา ฿1,800/ชม. | วันหยุด ฿2,200/ชม.',
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
