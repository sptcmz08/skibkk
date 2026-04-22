import { normalizeBankValue } from '@/lib/payment-channel'

export type BankBrand = {
    key: string
    short: string
    bg: string
    ring: string
    text: string
    logoSrc: string | null
    logoAlt: string
}

const FALLBACK_BRAND: Omit<BankBrand, 'key' | 'logoAlt'> = {
    short: 'BANK',
    bg: 'linear-gradient(135deg, #fef3c7, #facc15)',
    ring: 'rgba(250,204,21,0.24)',
    text: '#a16207',
    logoSrc: null,
}

const BANK_BRANDS: Record<string, Omit<BankBrand, 'key' | 'logoAlt'>> = {
    kbank: {
        short: 'KBank',
        bg: 'linear-gradient(135deg, #34d399, #16a34a)',
        ring: 'rgba(22,163,74,0.18)',
        text: '#166534',
        logoSrc: '/banks/kbank.png',
    },
    bbl: {
        short: 'BBL',
        bg: 'linear-gradient(135deg, #60a5fa, #2563eb)',
        ring: 'rgba(37,99,235,0.18)',
        text: '#1d4ed8',
        logoSrc: '/banks/bbl.png',
    },
    scb: {
        short: 'SCB',
        bg: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
        ring: 'rgba(124,58,237,0.18)',
        text: '#6d28d9',
        logoSrc: '/banks/scb.png',
    },
    ktb: {
        short: 'KTB',
        bg: 'linear-gradient(135deg, #67e8f9, #06b6d4)',
        ring: 'rgba(6,182,212,0.18)',
        text: '#0f766e',
        logoSrc: '/banks/ktb.png',
    },
    bay: {
        short: 'BAY',
        bg: 'linear-gradient(135deg, #fde68a, #facc15)',
        ring: 'rgba(250,204,21,0.24)',
        text: '#a16207',
        logoSrc: '/banks/bay.png',
    },
    ttb: {
        short: 'ttb',
        bg: 'linear-gradient(135deg, #93c5fd, #3b82f6)',
        ring: 'rgba(59,130,246,0.18)',
        text: '#1d4ed8',
        logoSrc: '/banks/tmb.png',
    },
    gsb: {
        short: 'GSB',
        bg: 'linear-gradient(135deg, #f9a8d4, #ec4899)',
        ring: 'rgba(236,72,153,0.18)',
        text: '#be185d',
        logoSrc: '/banks/gsb.png',
    },
    uob: {
        short: 'UOB',
        bg: 'linear-gradient(135deg, #93c5fd, #2563eb)',
        ring: 'rgba(37,99,235,0.18)',
        text: '#1d4ed8',
        logoSrc: '/banks/uob.png',
    },
    uobt: {
        short: 'UOB',
        bg: 'linear-gradient(135deg, #93c5fd, #2563eb)',
        ring: 'rgba(37,99,235,0.18)',
        text: '#1d4ed8',
        logoSrc: '/banks/uob.png',
    },
}

const buildFallbackShort = (bankName?: string) => {
    if (!bankName) return FALLBACK_BRAND.short
    return bankName.replace(/ธนาคาร|bank/gi, '').trim().slice(0, 4).toUpperCase() || FALLBACK_BRAND.short
}

export const getBankBrand = (bankName?: string): BankBrand => {
    const normalizedKey = normalizeBankValue(bankName)
    const bankBrand = BANK_BRANDS[normalizedKey]

    if (bankBrand) {
        return {
            key: normalizedKey,
            logoAlt: bankName || normalizedKey.toUpperCase(),
            ...bankBrand,
        }
    }

    return {
        key: normalizedKey || 'fallback',
        logoAlt: bankName || 'Bank',
        ...FALLBACK_BRAND,
        short: buildFallbackShort(bankName),
    }
}
