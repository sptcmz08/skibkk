export interface PackageSaleInvoiceRecord {
    invoiceNumber: string
    totalAmount: number
    vatAmount: number
    grandTotal: number
    customData?: Record<string, unknown> | null
    isIssued: boolean
    issuedAt?: string | null
    updatedAt?: string | null
}

export interface PackageSaleAuditDetails {
    saleNumber?: string
    customer?: {
        id?: string
        name?: string
        email?: string
        phone?: string
    }
    package?: {
        id?: string
        name?: string
        totalHours?: number
        price?: number
        validDays?: number
    }
    purchasedAt?: string
    expiresAt?: string
    invoice?: PackageSaleInvoiceRecord | null
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const parsePackageSaleAuditDetails = (raw: string | null | undefined): PackageSaleAuditDetails => {
    if (!raw) return {}
    try {
        const parsed = JSON.parse(raw) as unknown
        return isRecord(parsed) ? parsed as PackageSaleAuditDetails : {}
    } catch {
        return {}
    }
}

export const formatPackageSaleInvoiceNumber = (saleNumber: string) => {
    const newFormat = saleNumber.match(/^PKG(\d{6})(\d{5})$/)
    if (newFormat) return `INV-${newFormat[1]}${newFormat[2]}`

    const legacyMonthlyFormat = saleNumber.match(/^PKG-(\d{6})(\d{4})$/)
    if (legacyMonthlyFormat) return `INV-${legacyMonthlyFormat[1]}${legacyMonthlyFormat[2].padStart(5, '0')}`

    const legacyRandomFormat = saleNumber.match(/^PKG(\d{6})\d+$/)
    if (legacyRandomFormat) return `INV-${saleNumber.slice(3)}`

    return saleNumber.startsWith('INV-') ? saleNumber : `INV-${saleNumber}`
}

export const formatPackageSaleNumberFromUserPackageId = (userPackageId: string) => `PKG-${userPackageId.slice(0, 8).toUpperCase()}`

export const formatPackageSaleNumberFromDateSequence = (date: Date | string, sequence: number) => {
    const bangkokDate = new Date(new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
    const year = bangkokDate.getFullYear()
    const month = String(bangkokDate.getMonth() + 1).padStart(2, '0')
    return `PKG${year}${month}${String(sequence).padStart(5, '0')}`
}
