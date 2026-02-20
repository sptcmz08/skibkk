import { v4 as uuidv4 } from 'uuid'

export function generateBookingNumber(): string {
    const date = new Date()
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `BK${dateStr}${random}`
}

export function generateInvoiceNumber(): string {
    const date = new Date()
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `INV${year}${month}${random}`
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
    }).format(amount)
}

export function formatDate(date: Date | string): string {
    const d = new Date(date)
    return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

export function formatTime(time: string): string {
    return time.replace(':', '.')
}

export function formatDateShort(date: Date | string): string {
    const d = new Date(date)
    return d.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })
}

export function getDayOfWeek(date: Date): string {
    const days = [
        'SUNDAY',
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
    ]
    return days[date.getDay()]
}

export function getDayNameThai(day: string): string {
    const map: Record<string, string> = {
        MONDAY: 'จันทร์',
        TUESDAY: 'อังคาร',
        WEDNESDAY: 'พุธ',
        THURSDAY: 'พฤหัสบดี',
        FRIDAY: 'ศุกร์',
        SATURDAY: 'เสาร์',
        SUNDAY: 'อาทิตย์',
    }
    return map[day] || day
}

export function generateTimeSlots(
    openTime: string,
    closeTime: string
): string[] {
    const slots: string[] = []
    let [hours, minutes] = openTime.split(':').map(Number)
    const [endHours, endMinutes] = closeTime.split(':').map(Number)

    // Handle midnight (00:00) as end of day (24:00)
    const endTotal =
        endHours === 0 && endMinutes === 0
            ? 24 * 60
            : endHours * 60 + endMinutes

    while (hours * 60 + minutes < endTotal) {
        slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`)
        hours += 1
        if (hours >= 24) break
    }

    return slots
}

export function cn(...classes: (string | undefined | false | null)[]): string {
    return classes.filter(Boolean).join(' ')
}

export function getUUID(): string {
    return uuidv4()
}

export function calculateVat(amount: number, includesVat: boolean): { base: number; vat: number; total: number } {
    if (includesVat) {
        const base = amount / 1.07
        const vat = amount - base
        return { base: Math.round(base * 100) / 100, vat: Math.round(vat * 100) / 100, total: amount }
    }
    const vat = amount * 0.07
    return { base: amount, vat: Math.round(vat * 100) / 100, total: Math.round((amount + vat) * 100) / 100 }
}
