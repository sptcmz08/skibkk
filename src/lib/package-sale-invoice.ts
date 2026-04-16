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

export const formatPackageSaleInvoiceNumber = (saleNumber: string) => `INV-${saleNumber}`
