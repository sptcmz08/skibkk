export function formatInvoiceNumberFromBookingNumber(bookingNumber: string): string {
    const suffix = bookingNumber.startsWith('BK') ? bookingNumber.slice(2) : bookingNumber
    return `INV-${suffix}`
}
