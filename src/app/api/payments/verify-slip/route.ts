import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
    try {
        await requireAuth()
        const { image } = await req.json()

        if (!image) {
            return NextResponse.json({ error: 'กรุณาอัปโหลดรูปสลิป' }, { status: 400 })
        }

        const EASYSLIP_API_KEY = process.env.EASYSLIP_API_KEY
        if (!EASYSLIP_API_KEY) {
            return NextResponse.json({
                verified: false,
                fallback: true,
                error: 'ระบบตรวจสลิปอัตโนมัติยังไม่พร้อม กรุณาส่งสลิปเพื่อให้ admin ตรวจสอบ',
            })
        }

        // Convert base64 data URL to binary for multipart upload
        // Input: "data:image/png;base64,iVBORw0KGgo..."
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
        const binaryData = Buffer.from(base64Data, 'base64')

        // Detect mime type from data URL
        const mimeMatch = image.match(/^data:(image\/\w+);base64,/)
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png'
        const ext = mimeType.split('/')[1] || 'png'

        // Build multipart/form-data (EasySlip expects 'file' field)
        const formData = new FormData()
        const blob = new Blob([binaryData], { type: mimeType })
        formData.append('file', blob, `slip.${ext}`)

        // Call EasySlip API with 15-second timeout
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)

        let easyslipRes: Response
        try {
            easyslipRes = await fetch('https://developer.easyslip.com/api/v1/verify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${EASYSLIP_API_KEY}`,
                    // Do NOT set Content-Type — fetch auto-sets it with boundary for FormData
                },
                body: formData,
                signal: controller.signal,
            })
        } catch (fetchError) {
            clearTimeout(timeout)
            const isTimeout = (fetchError as Error).name === 'AbortError'
            console.error('EasySlip fetch error:', isTimeout ? 'TIMEOUT' : fetchError)
            return NextResponse.json({
                verified: false,
                fallback: true,
                error: isTimeout
                    ? 'ระบบตรวจสลิปตอบช้าเกินไป กรุณาส่งสลิปเพื่อให้ admin ตรวจสอบ'
                    : 'ไม่สามารถเชื่อมต่อระบบตรวจสลิปได้ กรุณาส่งสลิปเพื่อให้ admin ตรวจสอบ',
            })
        } finally {
            clearTimeout(timeout)
        }

        const result = await easyslipRes.json()

        if (!easyslipRes.ok || result.status !== 200) {
            console.error('EasySlip verify error:', JSON.stringify(result))
            const errorMsg = result.data?.message || result.message || 'ไม่สามารถตรวจสอบสลิปได้'
            return NextResponse.json({
                error: errorMsg,
                verified: false,
                fallback: true,
            }, { status: 400 })
        }

        // Extract slip data from response
        // EasySlip response format:
        // { status: 200, data: { amount: { amount: 1800 }, transRef: "...", sender: { name: "..." }, receiver: { name: "..." }, date: "...", sendingBank: "..." } }
        const slipData = result.data
        const amount = slipData?.amount?.amount || 0
        const transRef = slipData?.transRef || ''
        const sender = slipData?.sender?.name || ''
        const receiver = slipData?.receiver?.name || ''
        const date = slipData?.date || ''
        const bankCode = slipData?.sendingBank || ''

        return NextResponse.json({
            verified: true,
            amount: parseFloat(String(amount)),
            transRef,
            sender,
            receiver,
            date,
            bankCode,
        })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('Verify slip error:', error)
        return NextResponse.json({
            error: 'เกิดข้อผิดพลาดในการตรวจสอบสลิป',
            verified: false,
            fallback: true,
        }, { status: 500 })
    }
}
