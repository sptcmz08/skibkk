import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

// ==================== Shared HTML wrapper ====================
function emailWrapper(title: string, subtitle: string, bodyHtml: string) {
  return `
    <div style="font-family: 'Sarabun', 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f6fa;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 26px; letter-spacing: -0.5px;">🏟️ SKIBKK</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 16px;">${subtitle}</p>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
        ${bodyHtml}
        <div style="margin-top: 28px; text-align: center; padding-top: 20px; border-top: 1px solid #f0f0f0;">
          <p style="color: #9ca3af; font-size: 13px; margin: 0;">ขอบคุณที่ใช้บริการ SKIBKK 🙏</p>
          <p style="color: #d1d5db; font-size: 11px; margin: 4px 0 0;">อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ</p>
        </div>
      </div>
    </div>
  `
}

function itemsTableHtml(
  items: Array<{ courtName: string; date: string; startTime: string; endTime: string; price: number }>
) {
  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px;">${item.courtName}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px;">${item.date}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px;">${item.startTime} - ${item.endTime}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px; font-weight: 600;">฿${item.price.toLocaleString()}</td>
      </tr>
    `
    )
    .join('')

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr style="background: #f8f9fa;">
          <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #6b7280; font-weight: 600;">สนาม</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #6b7280; font-weight: 600;">วันที่</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #6b7280; font-weight: 600;">เวลา</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #6b7280; font-weight: 600;">ราคา</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

// ==================== Booking Confirmation Email ====================
export interface BookingEmailData {
  bookingNumber: string
  customerName: string
  items: Array<{
    courtName: string
    date: string
    startTime: string
    endTime: string
    price: number
  }>
  totalAmount: number
}

export async function sendBookingConfirmation(to: string, bookingData: BookingEmailData) {
  const bodyHtml = `
    <p style="font-size: 15px; color: #374151;">สวัสดีคุณ <strong>${bookingData.customerName}</strong>,</p>
    <p style="font-size: 15px; color: #374151;">การจองของคุณได้รับการยืนยันเรียบร้อยแล้ว ✅</p>

    <div style="background: #f0f4ff; padding: 14px 18px; border-radius: 10px; margin: 16px 0; border-left: 4px solid #667eea;">
      <p style="margin: 0; font-size: 14px; color: #374151;"><strong>หมายเลขการจอง:</strong> <span style="font-family: monospace; font-weight: 700; color: #667eea; font-size: 16px;">${bookingData.bookingNumber}</span></p>
    </div>

    ${itemsTableHtml(bookingData.items)}

    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px; border-radius: 10px; text-align: center; margin-top: 8px;">
      <p style="margin: 0; font-size: 20px; font-weight: 700;">ยอดรวม: ฿${bookingData.totalAmount.toLocaleString()}</p>
    </div>

    <div style="background: #fffbeb; padding: 14px 18px; border-radius: 10px; margin-top: 16px; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; font-size: 13px; color: #92400e;">📌 กรุณามาถึงสนามก่อนเวลาจองอย่างน้อย 15 นาที</p>
    </div>
  `

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"SKIBKK" <ae1nt14@gmail.com>',
      to,
      subject: `✅ ยืนยันการจอง #${bookingData.bookingNumber} - SKIBKK`,
      html: emailWrapper('ยืนยันการจอง', 'ยืนยันการจองสนามเรียบร้อยแล้ว', bodyHtml),
    })
    console.log(`📧 Confirmation email sent to ${to}`)
    return { success: true }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error }
  }
}

// ==================== Booking Reminder Email (1 day before) ====================
export async function sendBookingReminder(to: string, bookingData: BookingEmailData) {
  const bodyHtml = `
    <p style="font-size: 15px; color: #374151;">สวัสดีคุณ <strong>${bookingData.customerName}</strong>,</p>
    <p style="font-size: 15px; color: #374151;">นี่คือการแจ้งเตือนว่าคุณมี<strong>การจองในวันพรุ่งนี้</strong> 📅</p>

    <div style="background: #f0f4ff; padding: 14px 18px; border-radius: 10px; margin: 16px 0; border-left: 4px solid #667eea;">
      <p style="margin: 0; font-size: 14px; color: #374151;"><strong>หมายเลขการจอง:</strong> <span style="font-family: monospace; font-weight: 700; color: #667eea; font-size: 16px;">${bookingData.bookingNumber}</span></p>
    </div>

    ${itemsTableHtml(bookingData.items)}

    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px; border-radius: 10px; text-align: center; margin-top: 8px;">
      <p style="margin: 0; font-size: 20px; font-weight: 700;">ยอดรวม: ฿${bookingData.totalAmount.toLocaleString()}</p>
    </div>

    <div style="background: #ecfdf5; padding: 14px 18px; border-radius: 10px; margin-top: 16px; border-left: 4px solid #10b981;">
      <p style="margin: 0 0 6px; font-size: 13px; color: #065f46; font-weight: 600;">📌 เตรียมตัวก่อนมาเล่น:</p>
      <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #065f46;">
        <li>มาถึงก่อนเวลาจองอย่างน้อย 15 นาที</li>
        <li>สวมชุดกีฬาที่เหมาะสม</li>
        <li>เตรียมถุงเท้ายาวสำหรับสกี/สโนว์บอร์ด</li>
      </ul>
    </div>
  `

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"SKIBKK" <ae1nt14@gmail.com>',
      to,
      subject: `📅 แจ้งเตือน: คุณมีจองสนามพรุ่งนี้ #${bookingData.bookingNumber} - SKIBKK`,
      html: emailWrapper('แจ้งเตือนการจอง', 'คุณมีการจองในวันพรุ่งนี้', bodyHtml),
    })
    console.log(`📧 Reminder email sent to ${to}`)
    return { success: true }
  } catch (error) {
    console.error('Reminder email send error:', error)
    return { success: false, error }
  }
}
