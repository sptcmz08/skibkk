export const DEFAULT_LINE_CONFIRMATION_TEMPLATE = `✅ ยืนยันการจอง
#{bookingNumber}

สวัสดีคุณ {customerName}
การจองของคุณได้รับการยืนยันเรียบร้อยแล้ว

{items}

💳 ยอดรวม: ฿{totalAmount}

📍 สถานที่: SKI BKK ซอยรามอินทรา40 กทม.
📌 กรุณามาถึงก่อนเวลาจองอย่างน้อย 15 นาที`

export const DEFAULT_LINE_UPDATE_TEMPLATE = `🔄 มีการแก้ไขการจอง
#{bookingNumber}

สวัสดีคุณ {customerName}
รายการจองของคุณถูกอัปเดตโดยแอดมิน กรุณาตรวจสอบรายละเอียดล่าสุดดังนี้

{items}

💳 ยอดรวมล่าสุด: ฿{totalAmount}

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

const formatItemsText = (items: BookingNotifyData['items']) =>
    items.map(item =>
        `🏟 ${item.courtName}\n📅 ${item.date}\n⏰ ${item.startTime} - ${item.endTime}\n💰 ฿${item.price.toLocaleString()}`
    ).join('\n\n')

export const renderLineBookingTemplate = (
    template: string | null | undefined,
    data: BookingNotifyData,
    fallbackTemplate: string,
) => {
    const safeTemplate = (template || fallbackTemplate).trim() || fallbackTemplate

    return safeTemplate
        .replaceAll('{bookingNumber}', data.bookingNumber)
        .replaceAll('{customerName}', data.customerName)
        .replaceAll('{items}', formatItemsText(data.items))
        .replaceAll('{totalAmount}', data.totalAmount.toLocaleString())
}
