type DateLike = string | Date | null | undefined

const SHORT_THAI_DATE: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
}

export function parsePackageDate(value: DateLike): Date | null {
    if (!value) return null
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

export function formatPackageDate(value: DateLike): string {
    const date = parsePackageDate(value)
    return date ? date.toLocaleDateString('th-TH', SHORT_THAI_DATE) : '-'
}

export function formatPackageBookingWindow(validFrom: DateLike, validTo: DateLike): string | null {
    const from = parsePackageDate(validFrom)
    const to = parsePackageDate(validTo)

    if (from && to) return `${formatPackageDate(from)} - ${formatPackageDate(to)}`
    if (from) return `เริ่ม ${formatPackageDate(from)}`
    if (to) return `ถึง ${formatPackageDate(to)}`
    return null
}

export function resolvePackageBookingWindow(
    validFrom: DateLike,
    validTo: DateLike,
    fallbackStart: DateLike,
    fallbackEnd: DateLike
) {
    return {
        start: parsePackageDate(validFrom) ?? parsePackageDate(fallbackStart),
        end: parsePackageDate(validTo) ?? parsePackageDate(fallbackEnd),
    }
}
