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
    enableQrCode: true,
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
            enableQrCode: value.enableQrCode !== false,
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

export const normalizeTextValue = (value: string | null | undefined) =>
    String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()

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
