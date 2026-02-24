import { NextRequest, NextResponse } from 'next/server'
import generatePayload from 'promptpay-qr'
import QRCode from 'qrcode'

export async function POST(req: NextRequest) {
    try {
        const { amount } = await req.json()

        // Get PromptPay number from env or use default
        const promptpayNumber = process.env.PROMPTPAY_NUMBER || '0000000000'
        const payload = generatePayload(promptpayNumber, { amount: Number(amount) })
        const qrDataUrl = await QRCode.toDataURL(payload, {
            width: 400,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
        })

        return NextResponse.json({ qrDataUrl, amount })
    } catch (error) {
        console.error('QR generation error:', error)
        return NextResponse.json({ error: 'ไม่สามารถสร้าง QR Code ได้' }, { status: 500 })
    }
}
