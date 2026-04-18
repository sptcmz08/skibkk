import crypto from 'crypto'

export function generateBookingNumber(): string {
    const date = new Date()
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
    return `BK${dateStr}${random}`
}

export function generateInvoiceNumber(): string {
    const date = new Date()
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
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
    const [openHours, openMinutes] = openTime.split(':').map(Number)
    const [closeHours, closeMinutes] = closeTime.split(':').map(Number)

    if (
        [openHours, openMinutes, closeHours, closeMinutes].some(value => !Number.isFinite(value))
    ) {
        return slots
    }

    const startTotal = openHours * 60 + openMinutes
    let endTotal = closeHours * 60 + closeMinutes

    if (endTotal <= startTotal) {
        endTotal += 24 * 60
    }

    for (let cursor = startTotal; cursor < endTotal; cursor += 60) {
        const displayMinutes = cursor % (24 * 60)
        const hours = Math.floor(displayMinutes / 60)
        const minutes = displayMinutes % 60
        slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`)
    }

    return slots
}

type PricingTimeRule = {
    startTime: string
    endTime: string
    price: number
    priority?: number | null
    courtId?: string | null
}

function parseTimeToMinutes(time: string): number | null {
    const [hours, minutes] = time.split(':').map(Number)
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
    return hours * 60 + minutes
}

function normalizeRuleRange(rule: PricingTimeRule): { start: number; end: number; duration: number } | null {
    const start = parseTimeToMinutes(rule.startTime)
    let end = parseTimeToMinutes(rule.endTime)
    if (start === null || end === null) return null

    if (end <= start) {
        end += 24 * 60
    }

    return { start, end, duration: end - start }
}

export function isTimeInPricingRule(time: string, rule: PricingTimeRule): boolean {
    const range = normalizeRuleRange(rule)
    const timeMinutes = parseTimeToMinutes(time)
    if (!range || timeMinutes === null) return false

    const normalizedTime = timeMinutes < range.start && range.end > 24 * 60
        ? timeMinutes + 24 * 60
        : timeMinutes

    return normalizedTime >= range.start && normalizedTime < range.end
}

export function resolveSlotPrice<T extends PricingTimeRule>(time: string, rules: T[]): number {
    const matches = rules
        .map((rule, index) => ({ rule, index, range: normalizeRuleRange(rule) }))
        .filter((item): item is { rule: T; index: number; range: { start: number; end: number; duration: number } } =>
            item.range !== null && isTimeInPricingRule(time, item.rule)
        )
        .sort((a, b) => {
            const priorityDiff = (b.rule.priority ?? 0) - (a.rule.priority ?? 0)
            if (priorityDiff !== 0) return priorityDiff

            const courtSpecificDiff = Number(Boolean(b.rule.courtId)) - Number(Boolean(a.rule.courtId))
            if (courtSpecificDiff !== 0) return courtSpecificDiff

            const durationDiff = a.range.duration - b.range.duration
            if (durationDiff !== 0) return durationDiff

            const startDiff = b.range.start - a.range.start
            if (startDiff !== 0) return startDiff

            return a.index - b.index
        })

    return matches[0]?.rule.price ?? 0
}

export function cn(...classes: (string | undefined | false | null)[]): string {
    return classes.filter(Boolean).join(' ')
}

export function getUUID(): string {
    return crypto.randomUUID()
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
