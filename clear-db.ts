import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function clearData() {
  console.log('🗑️ กำลังล้างข้อมูลการทำรายการทั้งหมด...');

  // ลบข้อมูล Transaction (Foreign Keys ต้องลบลูกก่อนแม่)
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
  
  // ลบลูกค้าทั่วไป (เก็บ ADMIN / SUPERUSER / STAFF ไว้)
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      role: {
        notIn: ['ADMIN', 'SUPERUSER'],
      },
    },
  });

  console.log(`✅ ลบ Audit Logs, Slot Locks, Participants, Payments, Invoices, Evaluations, Used Slips, Booking Items, User Packages และ Bookings สำเร็จ!`);
  console.log(`✅ ลบผู้ใช้งานทั่วไปจำนวน ${deletedUsers.count} บัญชี`);
  console.log('✅ ล้างข้อมูลการจองและการชำระเงินสำเร็จครบถ้วน!');
  console.log('ℹ️ ข้อมูลระบบ (สาขา, สนาม, ราคา, Package, ผู้สอน, Admin) ยังคงอยู่\n');
}

clearData()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
