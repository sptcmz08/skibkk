import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('🧹 เริ่มเคลียร์ข้อมูล (ยกเว้น Admin)...')

    // Delete in reverse dependency order
    await prisma.participant.deleteMany()
    await prisma.bookingItem.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.invoice.deleteMany()
    await prisma.auditLog.deleteMany()
    await prisma.teacherEvaluation.deleteMany()
    await prisma.teacherSchedule.deleteMany()
    await prisma.usedSlip.deleteMany()
    await prisma.userPackage.deleteMany()
    await prisma.slotLock.deleteMany()

    // Delete main operational entities
    await prisma.booking.deleteMany()
    await prisma.teacher.deleteMany()
    await prisma.package.deleteMany()
    
    // Closed dates and special dates
    await prisma.closedDate.deleteMany()
    await prisma.specialClosedDate.deleteMany()

    // Delete users except ADMIN/SUPERUSER
    const deletedUsers = await prisma.user.deleteMany({
        where: {
            role: { notIn: ['ADMIN', 'SUPERUSER'] }
        }
    })
    
    console.log(`✅ ลบข้อมูลรายการจอง, การชำระเงิน และข้อมูลการใช้งานทั้งหมดเรียบร้อยแล้ว`)
    console.log(`✅ ลบ User (ที่ไม่ใช่ Admin/SuperUser) ไปทั้งหมด ${deletedUsers.count} รายการ`)
    
    // Note: Venues, Courts, PricingRules, OperatingHours, SportTypes, SiteSettings are kept as they are system configurations.
    console.log('🎉 เคลียร์ข้อมูลเสร็จสมบูรณ์ พร้อมใช้งาน!')
}

main()
    .catch(e => { console.error('❌ Clear DB error:', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
