export type ReceiverInfo = {
    name: string
    account: string
    bankName: string
    learnedAt: string | null
    autoLearned: boolean
}

export type PaymentDisplayConfig = {
    enableQrCode: boolean
    enableBankDetails: boolean
}

export type PaymentChannelStatus = 'ready' | 'incomplete' | 'disabled'

export const emptyReceiver = (): ReceiverInfo => ({
    name: '',
    account: '',
    bankName: '',
    learnedAt: null,
    autoLearned: false,
})

export const defaultDisplayConfig = (): PaymentDisplayConfig => ({
    enableQrCode: false,
    enableBankDetails: true,
})

export const parseReceiver = (raw: string | null | undefined): ReceiverInfo | null => {
    if (!raw) return null
    try {
        const value = JSON.parse(raw) as Partial<ReceiverInfo>
        return {
            name: String(value.name || '').trim(),
            account: String(value.account || '').trim(),
            bankName: String(value.bankName || '').trim(),
            learnedAt: value.learnedAt || null,
            autoLearned: Boolean(value.autoLearned),
        }
    } catch {
        return null
    }
}

export const parseDisplayConfig = (raw: string | null | undefined): PaymentDisplayConfig => {
    if (!raw) return defaultDisplayConfig()
    try {
        const value = JSON.parse(raw) as Partial<PaymentDisplayConfig>
        return {
            // Simplify the payment flow: use bank details as the primary transfer channel.
            // We keep the field for backward compatibility, but new UI/logic no longer depends on uploaded payment images.
            enableQrCode: false,
            enableBankDetails: value.enableBankDetails !== false,
        }
    } catch {
        return defaultDisplayConfig()
    }
}

export const hasAnyReceiverData = (receiver: ReceiverInfo | null | undefined) =>
    Boolean(receiver?.name.trim() || receiver?.account.trim() || receiver?.bankName.trim())

export const isReceiverComplete = (receiver: ReceiverInfo | null | undefined) =>
    Boolean(receiver?.name.trim() && receiver?.account.trim() && receiver?.bankName.trim())

export const normalizeAccountValue = (value: string | null | undefined) =>
    String(value || '').replace(/[^0-9A-Za-z]/g, '').trim().toLowerCase()

export const normalizeAccountDigits = (value: string | null | undefined) =>
    String(value || '').replace(/\D/g, '').trim()

export const normalizeTextValue = (value: string | null | undefined) =>
    String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()

export const normalizeLooseTextValue = (value: string | null | undefined) =>
    String(value || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .replace(/บริษัท/gu, '')
        .replace(/จำกัด/gu, '')
        .replace(/บจก/gu, '')
        .replace(/บมจ/gu, '')
        .replace(/หจก/gu, '')
        .replace(/มหาชน/gu, '')
        .replace(/ร้าน/gu, '')
        .replace(/นาย/gu, '')
        .replace(/นางสาว/gu, '')
        .replace(/นาง/gu, '')
        .replace(/คุณ/gu, '')
        .replace(/company/gu, '')
        .replace(/limited/gu, '')
        .replace(/co/gu, '')
        .replace(/ltd/gu, '')
        .trim()

export const normalizeBankValue = (value: string | null | undefined) => {
    const normalized = String(value || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .replace(/^ธนาคาร/u, '')
        .replace(/^ธ/u, '')

    if (!normalized) return ''

    const aliases: Array<{ key: string; patterns: string[] }> = [
        { key: 'kbank', patterns: ['กสิกรไทย', 'kbank', 'kasikorn', 'kasikornbank'] },
        { key: 'scb', patterns: ['ไทยพาณิชย์', 'scb', 'siamcommercial', 'siamcommercialbank'] },
        { key: 'bbl', patterns: ['กรุงเทพ', 'bangkokbank', 'bangkok'] },
        { key: 'ktb', patterns: ['กรุงไทย', 'ktb', 'krungthai'] },
        { key: 'bay', patterns: ['กรุงศรี', 'krungsri', 'bay', 'ayudhya'] },
        { key: 'ttb', patterns: ['ttb', 'ทหารไทยธนชาต', 'ธนชาต'] },
        { key: 'gsb', patterns: ['ออมสิน', 'gsb', 'governmentsavings'] },
        { key: 'baac', patterns: ['ธกส', 'เพื่อการเกษตร', 'baac'] },
        { key: 'cimb', patterns: ['cimbthai', 'cimb', 'ซีไอเอ็มบี'] },
        { key: 'uob', patterns: ['uob', 'ยูโอบี'] },
        { key: 'lhb', patterns: ['แลนด์แอนด์เฮ้าส์', 'แลนด์แอนด์เฮาส์', 'lhbank', 'lhb'] },
    ]

    const matched = aliases.find(alias => alias.patterns.some(pattern => normalized.includes(pattern)))
    return matched?.key || normalized
}

export const accountValuesMatch = (actual: string | null | undefined, expected: string | null | undefined) => {
    const actualNormalized = normalizeAccountValue(actual)
    const expectedNormalized = normalizeAccountValue(expected)

    if (!actualNormalized || !expectedNormalized) {
        return false
    }

    if (actualNormalized === expectedNormalized) {
        return true
    }

    const actualDigits = normalizeAccountDigits(actual)
    const expectedDigits = normalizeAccountDigits(expected)

    if (actualDigits && expectedDigits) {
        if (actualDigits === expectedDigits) {
            return true
        }

        if (actualDigits.length >= 4 && expectedDigits.endsWith(actualDigits)) {
            return true
        }

        if (expectedDigits.length >= 4 && actualDigits.endsWith(expectedDigits)) {
            return true
        }
    }

    return false
}

export const textValuesMatch = (actual: string | null | undefined, expected: string | null | undefined) => {
    const actualNormalized = normalizeTextValue(actual)
    const expectedNormalized = normalizeTextValue(expected)
    const actualLoose = normalizeLooseTextValue(actual)
    const expectedLoose = normalizeLooseTextValue(expected)

    if (!actualNormalized || !expectedNormalized) {
        return false
    }

    return actualNormalized === expectedNormalized
        || actualNormalized.includes(expectedNormalized)
        || expectedNormalized.includes(actualNormalized)
        || (actualLoose && expectedLoose && (
            actualLoose === expectedLoose
            || actualLoose.includes(expectedLoose)
            || expectedLoose.includes(actualLoose)
        ))
}

export const bankValuesMatch = (actual: string | null | undefined, expected: string | null | undefined) => {
    const actualNormalized = normalizeBankValue(actual)
    const expectedNormalized = normalizeBankValue(expected)

    if (!actualNormalized || !expectedNormalized) {
        return false
    }

    return actualNormalized === expectedNormalized
        || actualNormalized.includes(expectedNormalized)
        || expectedNormalized.includes(actualNormalized)
}

export const receiverValuesMatch = (
    actual: { name?: string | null; account?: string | null; bankName?: string | null },
    expected: ReceiverInfo | null | undefined,
) => {
    if (!expected) {
        return {
            matched: false,
            nameMatch: false,
            accountMatch: false,
            bankMatch: false,
        }
    }

    const nameMatch = textValuesMatch(actual.name, expected.name)
    const accountMatch = accountValuesMatch(actual.account, expected.account)
    const bankMatch = bankValuesMatch(actual.bankName, expected.bankName)

    return {
        matched: bankMatch && (accountMatch || nameMatch),
        nameMatch,
        accountMatch,
        bankMatch,
    }
}

export const computePaymentChannelStatus = (input: {
    qrImage?: string | null
    receiver?: ReceiverInfo | null
    displayConfig?: PaymentDisplayConfig | null
}) => {
    const qrImage = input.qrImage || null
    const receiver = input.receiver || null
    const displayConfig = input.displayConfig || defaultDisplayConfig()

    const receiverComplete = isReceiverComplete(receiver)
    const hasUsableQr = displayConfig.enableQrCode && Boolean(qrImage)
    const hasUsableBank = displayConfig.enableBankDetails && receiverComplete
    const hasUsableTransferChannel = receiverComplete && (hasUsableQr || displayConfig.enableBankDetails)

    if (!displayConfig.enableQrCode && !displayConfig.enableBankDetails) {
        return {
            status: 'disabled' as PaymentChannelStatus,
            hasUsableQr,
            hasUsableBank,
            hasUsableTransferChannel: false,
        }
    }

    if (hasUsableTransferChannel) {
        return {
            status: 'ready' as PaymentChannelStatus,
            hasUsableQr,
            hasUsableBank,
            hasUsableTransferChannel,
        }
    }

    return {
        status: 'incomplete' as PaymentChannelStatus,
        hasUsableQr,
        hasUsableBank,
        hasUsableTransferChannel: false,
    }
}
