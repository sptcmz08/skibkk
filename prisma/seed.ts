import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { DayOfWeek } from '@prisma/client'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const ALL_DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

async function main() {
    console.log('🌱 เริ่ม seed ข้อมูล...')

    // ────────────────────────────
    // 1. Venues (สถานที่เรียน)
    // ────────────────────────────
    const venue1 = await prisma.venue.upsert({
        where: { id: 'venue-ramintra40' },
        update: { name: 'SKIBKK รามอินทรา 40', sortOrder: 1, isActive: true },
        create: { id: 'venue-ramintra40', name: 'SKIBKK รามอินทรา 40', sortOrder: 1, isActive: true },
    })
    const venue2 = await prisma.venue.upsert({
        where: { id: 'venue-fashion' },
        update: { name: 'SKI BKK fashion', sortOrder: 2, isActive: true },
        create: { id: 'venue-fashion', name: 'SKI BKK fashion', sortOrder: 2, isActive: true },
    })
    const venue3 = await prisma.venue.upsert({
        where: { id: 'venue-chiangmai' },
        update: { name: 'SKI BKK เชียงใหม่', sortOrder: 3, isActive: true },
        create: { id: 'venue-chiangmai', name: 'SKI BKK เชียงใหม่', sortOrder: 3, isActive: true },
    })
    console.log('✅ Venues:', venue1.name, venue2.name, venue3.name)

    // ────────────────────────────
    // 2. Courts (สนาม)
    // ────────────────────────────
    const courtsData = [
        // SKIBKK รามอินทรา 40
        {
            id: 'court-ramintra-slope1', name: 'สไลป์ 1',
            description: 'สไลปสกี และ สโนว์บอร์ด เหมาะสำหรับทุกระดับ',
            venueId: venue1.id, sortOrder: 2,
        },
        {
            id: 'court-ramintra-slope2', name: 'สไลป์ 2',
            description: 'สไลปสกี และ สโนว์บอร์ด ทุกระดับ',
            venueId: venue1.id, sortOrder: 4,
        },
        // SKI BKK fashion
        {
            id: 'court-fashion-slopeA', name: 'สโลป A',
            description: null,
            venueId: venue2.id, sortOrder: 1,
        },
        {
            id: 'court-fashion-slopeB', name: 'สโลป B',
            description: 'สไลปสโนบอร์ดสายหลัก เหมาะสำหรับทุกระดับ',
            venueId: venue2.id, sortOrder: 5,
        },
        // SKI BKK เชียงใหม่
        {
            id: 'court-chiangmai-dryslope1', name: 'Dry Slope 1',
            description: null,
            venueId: venue3.id, sortOrder: 1,
        },
    ]

    for (const c of courtsData) {
        await prisma.court.upsert({
            where: { id: c.id },
            update: { name: c.name, description: c.description, venueId: c.venueId, sortOrder: c.sortOrder, isActive: true },
            create: { id: c.id, name: c.name, description: c.description, venueId: c.venueId, sortOrder: c.sortOrder, isActive: true, status: 'ACTIVE' },
        })
    }
    console.log(`✅ Courts: ${courtsData.length} สนาม`)

    // ────────────────────────────
    // 3. Operating Hours (เวลาเปิด-ปิด)
    // ────────────────────────────
    const opHoursData: { courtId: string; dayOfWeek: DayOfWeek; openTime: string; closeTime: string }[] = []

    // SKIBKK รามอินทรา 40 — สไลป์ 1
    // จันทร์ 08:00-00:00, อังคาร 08:00-23:00, พุธ 08:00-23:00, พฤหัส 08:00-23:00, ศุกร์ 08:00-23:00, เสาร์ 08:00-23:00, อาทิตย์ 08:00-23:00
    for (const d of ALL_DAYS) {
        const open = '08:00'
        const close = d === 'MONDAY' ? '00:00' : '23:00'
        opHoursData.push({ courtId: 'court-ramintra-slope1', dayOfWeek: d, openTime: open, closeTime: close })
    }

    // SKIBKK รามอินทรา 40 — สไลป์ 2
    // ทุกวัน 09:00-00:00
    for (const d of ALL_DAYS) {
        opHoursData.push({ courtId: 'court-ramintra-slope2', dayOfWeek: d, openTime: '09:00', closeTime: '00:00' })
    }

    // SKI BKK fashion — สโลป A
    // ทุกวัน 09:00-00:00
    for (const d of ALL_DAYS) {
        opHoursData.push({ courtId: 'court-fashion-slopeA', dayOfWeek: d, openTime: '09:00', closeTime: '00:00' })
    }

    // SKI BKK fashion — สโลป B
    // ทุกวัน 08:00-23:00
    for (const d of ALL_DAYS) {
        opHoursData.push({ courtId: 'court-fashion-slopeB', dayOfWeek: d, openTime: '08:00', closeTime: '23:00' })
    }

    // SKI BKK เชียงใหม่ — Dry Slope 1
    // ทุกวัน 09:00-00:00
    for (const d of ALL_DAYS) {
        opHoursData.push({ courtId: 'court-chiangmai-dryslope1', dayOfWeek: d, openTime: '09:00', closeTime: '00:00' })
    }

    for (const oh of opHoursData) {
        await prisma.operatingHours.upsert({
            where: { courtId_dayOfWeek: { courtId: oh.courtId, dayOfWeek: oh.dayOfWeek } },
            update: { openTime: oh.openTime, closeTime: oh.closeTime, isClosed: false },
            create: { courtId: oh.courtId, dayOfWeek: oh.dayOfWeek, openTime: oh.openTime, closeTime: oh.closeTime, isClosed: false },
        })
    }
    console.log(`✅ Operating Hours: ${opHoursData.length} รายการ`)

    // ────────────────────────────
    // 4. Pricing Rules (กำหนดราคา)
    // ────────────────────────────
    // Rule 1: ทุกสนาม, 00:00-02:00, ₿2,500, รวม VAT
    await prisma.pricingRule.upsert({
        where: { id: 'price-all-late' },
        update: { price: 2500, includesVat: true, startTime: '00:00', endTime: '02:00', daysOfWeek: ALL_DAYS },
        create: { id: 'price-all-late', courtId: null, daysOfWeek: ALL_DAYS, startTime: '00:00', endTime: '02:00', price: 2500, includesVat: true, isActive: true, priority: 0 },
    })

    // Rule 2: ทุกสนาม, เสาร์-อาทิตย์, 09:00-00:00, ₿2,200, รวม VAT
    await prisma.pricingRule.upsert({
        where: { id: 'price-all-weekend' },
        update: { price: 2200, includesVat: true, startTime: '09:00', endTime: '00:00', daysOfWeek: ['SATURDAY', 'SUNDAY'] },
        create: { id: 'price-all-weekend', courtId: null, daysOfWeek: ['SATURDAY', 'SUNDAY'], startTime: '09:00', endTime: '00:00', price: 2200, includesVat: true, isActive: true, priority: 0 },
    })

    // Rule 3: ทุกสนาม, จันทร์-ศุกร์, 09:00-00:00, ₿1, รวม VAT (from screenshot)
    await prisma.pricingRule.upsert({
        where: { id: 'price-all-weekday' },
        update: { price: 1, includesVat: true, startTime: '09:00', endTime: '00:00', daysOfWeek: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] },
        create: { id: 'price-all-weekday', courtId: null, daysOfWeek: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'], startTime: '09:00', endTime: '00:00', price: 1, includesVat: true, isActive: true, priority: 0 },
    })

    console.log('✅ Pricing Rules: 3 รายการ')

    // ────────────────────────────
    // 5. Admin User (ถ้ายังไม่มี)
    // ────────────────────────────
    const adminExists = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (!adminExists) {
        const bcrypt = require('bcryptjs')
        await prisma.user.create({
            data: {
                email: 'admin@skibkk.com',
                password: await bcrypt.hash('admin1234', 10),
                name: 'Admin SKIBKK',
                phone: '0000000000',
                role: 'ADMIN',
            },
        })
        console.log('✅ Admin user created: admin@skibkk.com / admin1234')
    } else {
        console.log('ℹ️  Admin user already exists — skipped')
    }

    console.log('\n🎉 Seed เสร็จสมบูรณ์!')
}

main()
    .catch(e => { console.error('❌ Seed error:', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
