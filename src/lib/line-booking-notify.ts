export const DEFAULT_LINE_CONFIRMATION_NOTE = `การจองของคุณได้รับการยืนยันเรียบร้อยแล้ว

📍 สถานที่: SKI BKK ซอยรามอินทรา40 กทม.
📌 กรุณามาถึงก่อนเวลาจองอย่างน้อย 15 นาที`

export const DEFAULT_LINE_UPDATE_NOTE = `รายการจองของคุณถูกอัปเดตโดยแอดมิน กรุณาตรวจสอบรายละเอียดล่าสุดดังนี้

หากมีข้อสงสัย กรุณาติดต่อ LINE Official ของร้านได้เลย`

export const DEFAULT_LINE_REMINDER_NOTE = `📍 สถานที่: SKI BKK ซอยรามอินทรา40 กทม.

📌 เตรียมตัวก่อนมาเล่น:
• มาถึงก่อนเวลาจองอย่างน้อย 15 นาที
• สวมชุดกีฬาที่เหมาะสม
• เตรียมถุงเท้ายาวสำหรับสกี/สโนว์บอร์ด

แผนที่: https://maps.app.goo.gl/K73h3Wgm3Kx2dv6R9`

type BookingNotifyData = {
    bookingNumber: string
    customerName: string
    items: Array<{
        courtName: string
        date: string
        startTime: string
        endTime: string
        price: number
        timeRanges?: Array<{
            startTime: string
            endTime: string
        }>
        original?: {
            courtName?: string
            date?: string
            startTime?: string
            endTime?: string
        } | null
    }>
    totalAmount: number
    packageUsage?: {
        packageName?: string | null
        hoursUsed?: number | null
        hoursRemaining?: number | null
    } | null
}

const PROTECTED_TOKENS = ['{bookingNumber}', '{customerName}', '{items}', '{totalAmount}']

const formatItemsText = (items: BookingNotifyData['items']) =>
    items.map(item => {
        const originalParts = [
            item.original?.courtName,
            item.original?.date,
            item.original?.startTime && item.original?.endTime
                ? `เวลา ${item.original.startTime} - ${item.original.endTime}`
                : item.original?.startTime,
        ].filter(Boolean)
        const originalText = originalParts.length
            ? `\n↩️ เดิม: ${originalParts.join(' | ')}`
            : ''
        const timeText = item.timeRanges?.length
            ? item.timeRanges.map(range => `${range.startTime} - ${range.endTime}`).join('\n⏰ ')
            : `${item.startTime} - ${item.endTime}`

        return `🏟 ${item.courtName}\n📅 ${item.date}\n⏰ ${timeText}${originalText}`
    }).join('\n\n')

export const normalizeLineEditableNote = (
    note: string | null | undefined,
    fallbackNote: string,
) => {
    const trimmed = note?.trim()
    if (!trimmed) return fallbackNote
    if (PROTECTED_TOKENS.some(token => trimmed.includes(token))) return fallbackNote
    return trimmed
}

export const buildLineConfirmationMessage = (
    note: string | null | undefined,
    data: BookingNotifyData,
) => {
    const safeNote = normalizeLineEditableNote(note, DEFAULT_LINE_CONFIRMATION_NOTE)
    const packageUsageLines = data.packageUsage
        ? [
            '🎫 ชำระด้วยแพ็คเกจ',
            data.packageUsage.packageName ? `แพ็คเกจ: ${data.packageUsage.packageName}` : null,
            Number.isFinite(data.packageUsage.hoursUsed) ? `ใช้ไป: ${Number(data.packageUsage.hoursUsed)} ชม.` : null,
            Number.isFinite(data.packageUsage.hoursRemaining) ? `คงเหลือ: ${Number(data.packageUsage.hoursRemaining)} ชม.` : null,
        ].filter(Boolean).join('\n')
        : ''
    const packageSection = packageUsageLines ? `\n\n${packageUsageLines}` : ''
    return `✅ ยืนยันการจอง\n#${data.bookingNumber}\n\nสวัสดีคุณ ${data.customerName}\n${safeNote}\n\n${formatItemsText(data.items)}${packageSection}\n\n💳 ยอดรวม: ฿${data.totalAmount.toLocaleString()}`
}

export const buildLineUpdateMessage = (
    note: string | null | undefined,
    data: BookingNotifyData,
) => {
    const safeNote = normalizeLineEditableNote(note, DEFAULT_LINE_UPDATE_NOTE)
    return `🔄 มีการแก้ไขการจอง\n#${data.bookingNumber}\n\nสวัสดีคุณ ${data.customerName}\n${safeNote}\n\n${formatItemsText(data.items)}`
}

export const buildLineReminderMessage = (
    note: string | null | undefined,
    data: BookingNotifyData,
    headerText = '📅 แจ้งเตือน: คุณมีจองสนามพรุ่งนี้!',
) => {
    const safeNote = normalizeLineEditableNote(note, DEFAULT_LINE_REMINDER_NOTE)
    return `${headerText}\n\nสวัสดีคุณ ${data.customerName}\nหมายเลขจอง: #${data.bookingNumber}\n\n${formatItemsText(data.items)}\n\n${safeNote}`
}
