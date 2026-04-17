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

export const formatPackageSaleInvoiceNumber = (saleNumber: string) => saleNumber

export const formatPackageSaleNumberFromUserPackageId = (userPackageId: string) => `PKG-${userPackageId.slice(0, 8).toUpperCase()}`

export const formatPackageSaleNumberFromDateSequence = (date: Date | string, sequence: number) => {
    const bangkokDate = new Date(new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
    const year = bangkokDate.getFullYear()
    const month = String(bangkokDate.getMonth() + 1).padStart(2, '0')
    return `PKG-${year}${month}${String(sequence).padStart(4, '0')}`
}
