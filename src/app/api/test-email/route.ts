import { NextResponse } from 'next/server'
import { sendBookingConfirmation, sendBookingReminder } from '@/lib/mailer'

// Test endpoint - DELETE THIS IN PRODUCTION
export async function GET() {
    const testEmail = 'ae1nt14@gmail.com'

    // 1. Test confirmation email
    const confirmResult = await sendBookingConfirmation(testEmail, {
        bookingNumber: 'BK-TEST-001',
        customerName: 'ทดสอบ ระบบ',
        items: [
            {
                courtName: 'สนาม A',
                date: '21 กุมภาพันธ์ 2569',
                startTime: '10:00',
                endTime: '11:00',
                price: 2200,
            },
            {
                courtName: 'สนาม A',
                date: '21 กุมภาพันธ์ 2569',
                startTime: '11:00',
                endTime: '12:00',
                price: 2200,
            },
        ],
        totalAmount: 4400,
    })

    // 2. Test reminder email
    const reminderResult = await sendBookingReminder(testEmail, {
        bookingNumber: 'BK-TEST-001',
        customerName: 'ทดสอบ ระบบ',
        items: [
            {
                courtName: 'สนาม A',
                date: '21 กุมภาพันธ์ 2569',
                startTime: '10:00',
                endTime: '11:00',
                price: 2200,
            },
        ],
        totalAmount: 2200,
    })

    return NextResponse.json({
        confirmation: confirmResult,
        reminder: reminderResult,
    })
}
