export const DEFAULT_LINE_CONFIRMATION_NOTE = `การจองของคุณได้รับการยืนยันเรียบร้อยแล้ว

📍 สถานที่: SKI BKK ซอยรามอินทรา40 กทม.
📌 กรุณามาถึงก่อนเวลาจองอย่างน้อย 15 นาที`

export const DEFAULT_LINE_UPDATE_NOTE = `รายการจองของคุณถูกอัปเดตโดยแอดมิน กรุณาตรวจสอบรายละเอียดล่าสุดดังนี้

หากมีข้อสงสัย กรุณาติดต่อ LINE Official ของร้านได้เลย`

type BookingNotifyData = {
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

const PROTECTED_TOKENS = ['{bookingNumber}', '{customerName}', '{items}', '{totalAmount}']

const formatItemsText = (items: BookingNotifyData['items']) =>
    items.map(item =>
        `🏟 ${item.courtName}\n📅 ${item.date}\n⏰ ${item.startTime} - ${item.endTime}\n💰 ฿${item.price.toLocaleString()}`
    ).join('\n\n')

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
    return `✅ ยืนยันการจอง\n#${data.bookingNumber}\n\nสวัสดีคุณ ${data.customerName}\n${safeNote}\n\n${formatItemsText(data.items)}\n\n💳 ยอดรวม: ฿${data.totalAmount.toLocaleString()}`
}

export const buildLineUpdateMessage = (
    note: string | null | undefined,
    data: BookingNotifyData,
) => {
    const safeNote = normalizeLineEditableNote(note, DEFAULT_LINE_UPDATE_NOTE)
    return `🔄 มีการแก้ไขการจอง\n#${data.bookingNumber}\n\nสวัสดีคุณ ${data.customerName}\n${safeNote}\n\n${formatItemsText(data.items)}\n\n💳 ยอดรวมล่าสุด: ฿${data.totalAmount.toLocaleString()}`
}
