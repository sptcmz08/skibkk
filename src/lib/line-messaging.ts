// LINE Messaging API — Push messages to users via their lineUserId
// Requires LINE_CHANNEL_ACCESS_TOKEN env variable (from LINE Developers Console → Messaging API)

const LINE_API = 'https://api.line.me/v2/bot/message/push'

interface LineMessage {
    type: 'text' | 'flex'
    text?: string
    altText?: string
    contents?: object
}

export function isValidLineUserId(lineUserId: string | null | undefined) {
    return typeof lineUserId === 'string' && /^U[0-9a-f]{32}$/i.test(lineUserId.trim())
}

/**
 * Send a LINE push message to a user
 */
export async function sendLinePush(lineUserId: string, messages: LineMessage[]) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!token) {
        console.warn('⚠️ LINE_CHANNEL_ACCESS_TOKEN not set, skipping LINE push')
        return { success: false, error: 'No LINE access token' }
    }

    const trimmedLineUserId = lineUserId.trim()
    if (!isValidLineUserId(trimmedLineUserId)) {
        console.warn(`Skipping LINE push: invalid LINE userId "${trimmedLineUserId}"`)
        return { success: false, error: 'Invalid LINE userId' }
    }

    try {
        const res = await fetch(LINE_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                to: trimmedLineUserId,
                messages,
            }),
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            console.error(`LINE push error for ${trimmedLineUserId}:`, res.status, err)
            return { success: false, error: err }
        }

        console.log(`✅ LINE push sent to ${trimmedLineUserId}`)
        return { success: true }
    } catch (error) {
        console.error(`LINE push error for ${trimmedLineUserId}:`, error)
        return { success: false, error }
    }
}

/**
 * Send booking confirmation via LINE
 */
export async function sendLineBookingConfirmation(lineUserId: string, data: {
    bookingNumber: string
    customerName: string
    items: Array<{ courtName: string; date: string; startTime: string; endTime: string; price: number }>
    totalAmount: number
}) {
    const itemsText = data.items.map(item =>
        `🏟 ${item.courtName}\n📅 ${item.date}\n⏰ ${item.startTime} - ${item.endTime}\n💰 ฿${item.price.toLocaleString()}`
    ).join('\n\n')

    const message = `✅ ยืนยันการจอง #${data.bookingNumber}\n\nสวัสดีคุณ ${data.customerName}\nการจองของคุณได้รับการยืนยันเรียบร้อยแล้ว\n\n${itemsText}\n\n💳 ยอดรวม: ฿${data.totalAmount.toLocaleString()}\n\n📍 สถานที่: SKI BKK ซอยรามอินทรา40 กทม.\n📌 กรุณามาถึงก่อนเวลาจองอย่างน้อย 15 นาที`

    return sendLinePush(lineUserId, [{ type: 'text', text: message }])
}

/**
 * Send booking reminder via LINE (1 day before)
 */
export async function sendLineBookingReminder(lineUserId: string, message: string) {
    return sendLinePush(lineUserId, [{ type: 'text', text: message }])
}

/**
 * Send evaluation request via LINE after lesson ends
 */
export async function sendLineEvaluationRequest(lineUserId: string, data: {
    customerName: string
    teacherName: string
    evaluationUrl: string
    courtName: string
    date: string
    startTime: string
    endTime: string
}) {
    const message = `⭐ แบบประเมินการสอน\n\nสวัสดีคุณ ${data.customerName}\nขอบคุณที่ใช้บริการ SKI BKK!\n\n🏟 ${data.courtName}\n📅 ${data.date}\n⏰ ${data.startTime} - ${data.endTime}\n👨‍🏫 ครูผู้สอน: ${data.teacherName}\n\nกรุณาช่วยประเมินครูผู้สอนเพื่อพัฒนาคุณภาพการบริการ:\n👉 ${data.evaluationUrl}\n\nขอบคุณครับ/ค่ะ 🙏`

    return sendLinePush(lineUserId, [{ type: 'text', text: message }])
}
