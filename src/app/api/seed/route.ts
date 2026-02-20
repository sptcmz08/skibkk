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
            const courtSki = await prisma.court.upsert({
                where: { id: 'court-ski' },
                update: { sportType: 'สกี้', name: 'Slope สกี้ A', description: 'สโลปสกี้หลัก สำหรับทุกระดับ' },
                create: {
                    id: 'court-ski',
                    name: 'Slope สกี้ A',
                    description: 'สโลปสกี้หลัก สำหรับทุกระดับ',
                    sportType: 'สกี้',
                    sortOrder: 1,
                },
            })

            const courtSnow = await prisma.court.upsert({
                where: { id: 'court-snow' },
                update: { sportType: 'สโนบอร์ด', name: 'Slope สโนบอร์ด B', description: 'สโลปสโนบอร์ด สำหรับผู้เริ่มต้นและขั้นกลาง' },
                create: {
                    id: 'court-snow',
                    name: 'Slope สโนบอร์ด B',
                    description: 'สโลปสโนบอร์ด สำหรับผู้เริ่มต้นและขั้นกลาง',
                    sportType: 'สโนบอร์ด',
                    sortOrder: 2,
                },
            })

            // Create operating hours (08:00-23:00, every day)
            const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const
            for (const court of [courtSki, courtSnow]) {
                for (const day of days) {
                    await prisma.operatingHours.upsert({
                        where: { courtId_dayOfWeek: { courtId: court.id, dayOfWeek: day } },
                        update: { openTime: '08:00', closeTime: '23:00', isClosed: false },
                        create: { courtId: court.id, dayOfWeek: day, openTime: '08:00', closeTime: '23:00', isClosed: false },
                    })
                }
            }

            // Create pricing rules
            for (const court of [courtSki, courtSnow]) {
                await prisma.pricingRule.deleteMany({ where: { courtId: court.id } })

                // Weekday pricing
                await prisma.pricingRule.create({
                    data: {
                        courtId: court.id,
                        daysOfWeek: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
                        startTime: '08:00',
                        endTime: '23:00',
                        price: 1800,
                        priority: 1,
                    },
                })

                // Weekend pricing
                await prisma.pricingRule.create({
                    data: {
                        courtId: court.id,
                        daysOfWeek: ['SATURDAY', 'SUNDAY'],
                        startTime: '08:00',
                        endTime: '23:00',
                        price: 2200,
                        priority: 1,
                    },
                })
            }

            return NextResponse.json({
                message: 'Seed data created!',
                courts: [courtSki, courtSnow],
                operatingHours: '08:00-23:00 ทุกวัน',
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
