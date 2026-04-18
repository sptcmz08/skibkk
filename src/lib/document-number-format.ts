export function formatInvoiceNumberFromBookingNumber(bookingNumber: string): string {
    const suffix = bookingNumber.startsWith('BK') ? bookingNumber.slice(2) : bookingNumber
    return `INV-${suffix}`
}

export function getInvoiceYearMonth(date: Date | string): string {
    const bangkokDate = new Date(new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
    const year = bangkokDate.getFullYear()
    const month = String(bangkokDate.getMonth() + 1).padStart(2, '0')
    return `${year}${month}`
}

export function formatInvoiceNumberFromYearMonthSequence(yearMonth: string, sequence: number): string {
    return `INV-${yearMonth}${String(sequence).padStart(5, '0')}`
}
