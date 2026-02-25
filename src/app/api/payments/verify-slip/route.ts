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
            return NextResponse.json({ error: 'ระบบยังไม่ได้ตั้งค่า EasySlip API' }, { status: 500 })
        }

        // Call EasySlip API to verify the slip
        const easyslipRes = await fetch('https://developer.easyslip.com/api/v1/verify', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${EASYSLIP_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image }),
        })

        const result = await easyslipRes.json()

        if (!easyslipRes.ok || result.status !== 200) {
            console.error('EasySlip verify error:', result)
            const errorMsg = result.data?.message || result.message || 'ไม่สามารถตรวจสอบสลิปได้'
            return NextResponse.json({
                error: errorMsg,
                verified: false,
            }, { status: 400 })
        }

        // Extract slip data
        const slipData = result.data
        const amount = slipData?.amount?.amount || 0
        const transRef = slipData?.transRef || ''
        const sender = slipData?.sender?.name || ''
        const receiver = slipData?.receiver?.name || ''
        const date = slipData?.date || ''
        const bankCode = slipData?.sendingBank || ''

        return NextResponse.json({
            verified: true,
            amount: parseFloat(amount),
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
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบสลิป' }, { status: 500 })
    }
}
