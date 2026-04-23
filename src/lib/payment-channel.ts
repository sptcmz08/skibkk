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

const CANDIDATE_SPLIT_REGEX = /[\n,;|]+|(?:\s\/\s)/g

const THAI_DIGIT_MAP: Record<string, string> = {
    '๐': '0',
    '๑': '1',
    '๒': '2',
    '๓': '3',
    '๔': '4',
    '๕': '5',
    '๖': '6',
    '๗': '7',
    '๘': '8',
    '๙': '9',
}

const normalizeUnicodeValue = (value: string | null | undefined) =>
    String(value || '').normalize('NFKC').trim()

const normalizeThaiDigits = (value: string | null | undefined) =>
    normalizeUnicodeValue(value).replace(/[๐-๙]/g, digit => THAI_DIGIT_MAP[digit] || digit)

const splitCandidateValues = (value: string | null | undefined) =>
    normalizeUnicodeValue(value)
        .split(CANDIDATE_SPLIT_REGEX)
        .map(item => item.trim())
        .filter(Boolean)

const BANK_ALIAS_GROUPS: Array<{ key: string; aliases: string[] }> = [
    {
        key: 'bbl',
        aliases: ['002', 'bbl', 'bangkokbank', 'bangkok', 'ธนาคารกรุงเทพ', 'กรุงเทพ'],
    },
    {
        key: 'kbank',
        aliases: ['004', 'kbank', 'kasikorn', 'kasikornbank', 'ธนาคารกสิกรไทย', 'กสิกรไทย', 'กสิกร'],
    },
    {
        key: 'ktb',
        aliases: ['006', 'ktb', 'krungthai', 'ธนาคารกรุงไทย', 'กรุงไทย'],
    },
    {
        key: 'ttb',
        aliases: ['011', 'ttb', 'tmbthanachart', 'ธนาคารทหารไทยธนชาต', 'ทหารไทยธนชาต', 'ธนชาต', 'ทีทีบี'],
    },
    {
        key: 'scb',
        aliases: ['014', 'scb', 'siamcommercial', 'siamcommercialbank', 'ธนาคารไทยพาณิชย์', 'ไทยพาณิชย์'],
    },
    {
        key: 'cimbt',
        aliases: ['022', 'cimb', 'cimbthai', 'cimbt', 'ธนาคารซีไอเอ็มบีไทย', 'ซีไอเอ็มบีไทย', 'ซีไอเอ็มบี'],
    },
    {
        key: 'uobt',
        aliases: ['024', 'uob', 'uobt', 'uobthai', 'ธนาคารยูโอบี', 'ยูโอบี'],
    },
    {
        key: 'bay',
        aliases: ['025', 'bay', 'krungsri', 'ayudhya', 'bankofayudhya', 'ธนาคารกรุงศรีอยุธยา', 'กรุงศรีอยุธยา', 'กรุงศรี'],
    },
    {
        key: 'gsb',
        aliases: ['030', 'gsb', 'governmentsavings', 'governmentsavingsbank', 'ธนาคารออมสิน', 'ออมสิน'],
    },
    {
        key: 'ghb',
        aliases: ['033', 'ghb', 'governmenthousing', 'governmenthousingbank', 'ธนาคารอาคารสงเคราะห์', 'อาคารสงเคราะห์'],
    },
    {
        key: 'baac',
        aliases: ['034', 'baac', 'ธกส', 'ธ.ก.ส', 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร', 'เพื่อการเกษตร'],
    },
    {
        key: 'exim',
        aliases: ['035', 'exim', 'eximthai', 'exportimport', 'exportimportbank', 'ธนาคารเพื่อการส่งออกและนำเข้าแห่งประเทศไทย', 'เพื่อการส่งออกและนำเข้า'],
    },
    {
        key: 'tisco',
        aliases: ['067', 'tisco', 'ธนาคารทิสโก้', 'ทิสโก้'],
    },
    {
        key: 'kkp',
        aliases: ['069', 'kkp', 'kiatnakin', 'kiatnakinphatra', 'phatra', 'ธนาคารเกียรตินาคินภัทร', 'เกียรตินาคินภัทร'],
    },
    {
        key: 'icbct',
        aliases: ['070', 'icbc', 'icbct', 'industrialandcommercialbankofchina', 'ธนาคารไอซีบีซีไทย', 'ธนาคารไอซีบีซี(ไทย)', 'ไอซีบีซีไทย', 'ไอซีบีซี'],
    },
    {
        key: 'tcd',
        aliases: ['071', 'tcd', 'thaicredit', 'ไทยเครดิต', 'ธนาคารไทยเครดิตเพื่อรายย่อย'],
    },
    {
        key: 'lhfg',
        aliases: ['073', 'lhfg', 'lhbank', 'landandhouses', 'ธนาคารแลนด์แอนด์เฮ้าส์', 'แลนด์แอนด์เฮ้าส์', 'แลนด์แอนด์เฮาส์'],
    },
    {
        key: 'sme',
        aliases: ['098', 'sme', 'smebank', 'ธนาคารพัฒนาวิสาหกิจขนาดกลางและขนาดย่อมแห่งประเทศไทย', 'พัฒนาวิสาหกิจขนาดกลางและขนาดย่อม', 'เอสเอ็มอี'],
    },
]

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
    normalizeThaiDigits(value).replace(/[^0-9A-Za-z]/g, '').trim().toLowerCase()

export const normalizeAccountDigits = (value: string | null | undefined) =>
    normalizeThaiDigits(value).replace(/\D/g, '').trim()

export const normalizeTextValue = (value: string | null | undefined) =>
    normalizeThaiDigits(value).replace(/\s+/g, ' ').trim().toLowerCase()

export const normalizeLooseTextValue = (value: string | null | undefined) =>
    normalizeTextValue(value)
        .replace(/[&]/g, ' and ')
        .replace(/\b(?:public company limited|company limited|co ltd|co\. ltd|co\.ltd|corporation|corp|incorporated|inc|limited|company|plc|llc|holdings?|group)\b/gu, ' ')
        .replace(/\b(?:mr|mrs|ms|miss|dr|prof)\b\.?/gu, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .replace(/บริษัท/gu, '')
        .replace(/จำกัดมหาชน/gu, '')
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

const getEnglishNameTokens = (value: string | null | undefined) =>
    normalizeTextValue(value)
        .replace(/[&]/g, ' and ')
        .replace(/\b(?:public company limited|company limited|co ltd|co\. ltd|co\.ltd|corporation|corp|incorporated|inc|limited|company|plc|llc|holdings?|group)\b/gu, ' ')
        .split(/[^a-z0-9]+/g)
        .map(token => token.trim())
        .filter(Boolean)

const getEnglishInitials = (tokens: string[]) =>
    tokens.map(token => token[0] || '').join('')

const englishAbbreviationValuesMatch = (actual: string | null | undefined, expected: string | null | undefined) => {
    const actualTokens = getEnglishNameTokens(actual)
    const expectedTokens = getEnglishNameTokens(expected)

    if (actualTokens.length < 2 || expectedTokens.length < 2 || actualTokens.length !== expectedTokens.length) {
        return false
    }

    const actualInitials = getEnglishInitials(actualTokens)
    const expectedInitials = getEnglishInitials(expectedTokens)
    const actualJoined = actualTokens.join('')
    const expectedJoined = expectedTokens.join('')

    if (actualInitials.length >= 3 && expectedInitials.length >= 3 && actualInitials === expectedInitials) {
        return true
    }

    if (actualInitials.length >= 3 && expectedJoined.startsWith(actualInitials)) {
        return true
    }

    if (expectedInitials.length >= 3 && actualJoined.startsWith(expectedInitials)) {
        return true
    }

    let sawAbbreviation = false

    const tokensMatch = actualTokens.every((actualToken, index) => {
        const expectedToken = expectedTokens[index]
        if (!expectedToken) return false

        if (actualToken === expectedToken) {
            return true
        }

        const shorter = actualToken.length <= expectedToken.length ? actualToken : expectedToken
        const longer = actualToken.length > expectedToken.length ? actualToken : expectedToken

        if (shorter.length <= 2 && longer.startsWith(shorter)) {
            sawAbbreviation = true
            return true
        }

        return false
    })

    return tokensMatch && sawAbbreviation
}

export const normalizeBankValue = (value: string | null | undefined) => {
    const normalized = normalizeThaiDigits(value)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .replace(/^ธนาคาร/u, '')
        .replace(/^ธ/u, '')
        .replace(/^bankof/u, '')

    if (!normalized) return ''

    const matched = BANK_ALIAS_GROUPS.find(alias => alias.aliases.some(pattern => normalized === pattern || normalized.includes(pattern) || pattern.includes(normalized)))
    return matched?.key || normalized
}

export const accountValuesMatch = (actual: string | null | undefined, expected: string | null | undefined) => {
    const actualCandidates = splitCandidateValues(actual)
    const expectedCandidates = splitCandidateValues(expected)

    return actualCandidates.some(actualCandidate => expectedCandidates.some(expectedCandidate => {
        const actualNormalized = normalizeAccountValue(actualCandidate)
        const expectedNormalized = normalizeAccountValue(expectedCandidate)

        if (!actualNormalized || !expectedNormalized) {
            return false
        }

        if (actualNormalized === expectedNormalized) {
            return true
        }

        const actualDigits = normalizeAccountDigits(actualCandidate)
        const expectedDigits = normalizeAccountDigits(expectedCandidate)

        if (!actualDigits || !expectedDigits) {
            return false
        }

        if (actualDigits === expectedDigits) {
            return true
        }

        if (actualDigits.length >= 4 && expectedDigits.endsWith(actualDigits)) {
            return true
        }

        if (expectedDigits.length >= 4 && actualDigits.endsWith(expectedDigits)) {
            return true
        }

        return actualDigits.slice(-4).length === 4
            && expectedDigits.slice(-4).length === 4
            && actualDigits.slice(-4) === expectedDigits.slice(-4)
    }))
}

export const textValuesMatch = (actual: string | null | undefined, expected: string | null | undefined) => {
    const actualCandidates = splitCandidateValues(actual)
    const expectedCandidates = splitCandidateValues(expected)

    return actualCandidates.some(actualCandidate => expectedCandidates.some(expectedCandidate => {
        const actualNormalized = normalizeTextValue(actualCandidate)
        const expectedNormalized = normalizeTextValue(expectedCandidate)
        const actualLoose = normalizeLooseTextValue(actualCandidate)
        const expectedLoose = normalizeLooseTextValue(expectedCandidate)

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
            || englishAbbreviationValuesMatch(actualCandidate, expectedCandidate)
    }))
}

export const bankValuesMatch = (actual: string | null | undefined, expected: string | null | undefined) => {
    const actualCandidates = splitCandidateValues(actual)
    const expectedCandidates = splitCandidateValues(expected)

    return actualCandidates.some(actualCandidate => expectedCandidates.some(expectedCandidate => {
        const actualNormalized = normalizeBankValue(actualCandidate)
        const expectedNormalized = normalizeBankValue(expectedCandidate)

        if (!actualNormalized || !expectedNormalized) {
            return false
        }

        return actualNormalized === expectedNormalized
            || actualNormalized.includes(expectedNormalized)
            || expectedNormalized.includes(actualNormalized)
    }))
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
    const hasActualBank = splitCandidateValues(actual.bankName).length > 0

    return {
        matched: (bankMatch && (accountMatch || nameMatch)) || (!hasActualBank && accountMatch && nameMatch),
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
