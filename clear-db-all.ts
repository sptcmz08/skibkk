import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function clearData() {
  console.log('🗑️ กำลังล้างข้อมูลทุกอย่างในระบบ (ยกเว้น Admin)...');

  // ลบข้อมูลการจองและการทำรายการทั้งหมด
  await prisma.auditLog.deleteMany();
  await prisma.slotLock.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.teacherEvaluation.deleteMany();
  await prisma.usedSlip.deleteMany();
  await prisma.bookingItem.deleteMany();
  await prisma.userPackage.deleteMany();
  await prisma.booking.deleteMany();
  
  // ลบข้อมูลการตั้งค่าโครงสร้าง
  await prisma.pricingRule.deleteMany();
  await prisma.operatingHours.deleteMany();
  await prisma.teacherSchedule.deleteMany();
  await prisma.court.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.specialClosedDate.deleteMany();
  await prisma.closedDate.deleteMany();
  await prisma.package.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.sportType.deleteMany();

  // ลบลูกค้าทั่วไป (เก็บ ADMIN / SUPERUSER ไว้)
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      role: {
        notIn: ['ADMIN', 'SUPERUSER'],
      },
    },
  });

  console.log(`✅ ลบข้อมูลการตั้งค่า (สาขา, สนาม, ราคา, แพ็คเกจ, ผู้สอน) สำเร็จ!`);
  console.log(`✅ ลบผู้ใช้งานทั่วไปจำนวน ${deletedUsers.count} บัญชี`);
  console.log('✅ ล้างข้อมูลทั้งหมดในฐานข้อมูลสำเร็จแล้ว! เหลือแค่บัญชีแอดมินเท่านั้น\n');
}

clearData()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
