import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
                error: 'ระบบตรวจสลิปอัตโนมัติยังไม่พร้อม กรุณาติดต่อ admin',
            }, { status: 500 })
        }

        // ============ STEP 1: Convert base64 → binary ============
        // Support all image formats: image/png, image/jpeg, image/jpg, image/webp, image/heic
        const base64Data = image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
        const binaryData = Buffer.from(base64Data, 'base64')

        // Validate: must have actual image data
        if (binaryData.length < 1000) {
            return NextResponse.json({ error: 'ไฟล์รูปภาพไม่ถูกต้องหรือเสียหาย', verified: false }, { status: 400 })
        }
        if (binaryData.length > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'ไฟล์ใหญ่เกินไป (สูงสุด 10MB)', verified: false }, { status: 400 })
        }

        // Detect mime type from data URL
        const mimeMatch = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/)
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
        // Normalize extension
        let ext = mimeType.split('/')[1] || 'jpg'
        if (ext === 'jpeg') ext = 'jpg'

        console.log(`[SlipVerify] Image: ${(binaryData.length / 1024).toFixed(0)}KB, type: ${mimeType}`)

        // ============ STEP 2: Send to EasySlip API ============
        const formData = new FormData()
        const blob = new Blob([binaryData], { type: mimeType })
        formData.append('file', blob, `slip.${ext}`)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)

        let easyslipRes: Response
        try {
            easyslipRes = await fetch('https://developer.easyslip.com/api/v1/verify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${EASYSLIP_API_KEY}`,
                },
                body: formData,
                signal: controller.signal,
            })
        } catch (fetchError) {
            clearTimeout(timeout)
            const isTimeout = (fetchError as Error).name === 'AbortError'
            console.error('[SlipVerify] Fetch error:', isTimeout ? 'TIMEOUT 15s' : fetchError)
            return NextResponse.json({
                verified: false,
                error: isTimeout
                    ? 'ระบบตรวจสลิปตอบช้าเกินไป กรุณาลองใหม่อีกครั้ง'
                    : 'ไม่สามารถเชื่อมต่อระบบตรวจสลิปได้ กรุณาลองใหม่อีกครั้ง',
            }, { status: 500 })
        } finally {
            clearTimeout(timeout)
        }

        // ============ STEP 3: Parse EasySlip response ============
        let result: any
        try {
            result = await easyslipRes.json()
        } catch {
            console.error('[SlipVerify] Failed to parse EasySlip JSON response, status:', easyslipRes.status)
            return NextResponse.json({
                error: 'ระบบตรวจสลิปส่งข้อมูลผิดรูปแบบ กรุณาลองใหม่',
                verified: false,
            }, { status: 500 })
        }

        if (!easyslipRes.ok || result.status !== 200) {
            console.error('[SlipVerify] EasySlip ERROR:', JSON.stringify(result))
            const errorMsg = result.data?.message || result.message || ''
            const statusCode = result.status || easyslipRes.status

            if (statusCode === 404 || errorMsg.includes('ไม่พบ') || errorMsg.includes('not found') || errorMsg.includes('No slip')) {
                return NextResponse.json({
                    error: 'ไม่พบข้อมูลสลิปในรูปนี้ — กรุณาใช้รูปสลิปจากแอปธนาคารโดยตรง (save/share รูปจากแอป ไม่ใช่ screenshot)',
                    verified: false,
                }, { status: 400 })
            }

            return NextResponse.json({
                error: `ตรวจสอบสลิปไม่สำเร็จ: ${errorMsg || 'กรุณาลองใหม่อีกครั้ง'}`,
                verified: false,
            }, { status: 400 })
        }

        // ============ STEP 4: Extract data from successful response ============
        const slipData = result.data
        console.log('[SlipVerify] SUCCESS — Full EasySlip data:', JSON.stringify(slipData, null, 2))

        const amount = slipData?.amount?.amount || 0
        const transRef = slipData?.transRef || ''
        // Sender: try displayName first (more complete), then name
        const sender = slipData?.sender?.displayName || slipData?.sender?.name || ''
        // Receiver: for personal transfer → name/account, for merchant QR → proxy fields
        const receiverName = slipData?.receiver?.displayName || slipData?.receiver?.name || ''
        const receiverAccount = slipData?.receiver?.account?.value || ''
        const receiverProxyName = slipData?.receiver?.proxy?.name || ''
        const receiverProxyValue = slipData?.receiver?.proxy?.value || ''
        const receiverProxyType = slipData?.receiver?.proxy?.type || '' // BILLERID, MSISDN, etc.
        const date = slipData?.date || ''
        const bankCode = slipData?.sendingBank || ''

        // Validate amount
        if (!amount || amount <= 0) {
            console.error('[SlipVerify] Invalid amount:', amount)
            return NextResponse.json({
                error: 'ไม่พบจำนวนเงินในสลิป กรุณาลองใหม่',
                verified: false,
            }, { status: 400 })
        }

        // ============ STEP 5: Duplicate slip detection ============
        if (transRef) {
            const [existingPayment, existingUsedSlip] = await Promise.all([
                prisma.payment.findFirst({ where: { slipHash: transRef } }),
                prisma.usedSlip.findFirst({ where: { slipHash: transRef } }),
            ])
            if (existingPayment || existingUsedSlip) {
                return NextResponse.json({
                    error: 'สลิปนี้ถูกใช้งานแล้ว ไม่สามารถใช้ซ้ำได้',
                    verified: false,
                }, { status: 400 })
            }
        }

        // ============ STEP 6: Verify receiver — Auto-learn from DB ============
        // Try DB first, fall back to .env for backward compatibility
        let expectedReceiver = ''
        let expectedAccount = ''
        let isLearningMode = false

        try {
            const receiverSetting = await prisma.siteSetting.findUnique({ where: { key: 'payment_receiver' } })
            if (receiverSetting) {
                const receiverData = JSON.parse(receiverSetting.value)
                expectedReceiver = receiverData.name || ''
                expectedAccount = receiverData.account || ''
                isLearningMode = !expectedReceiver && !expectedAccount
            } else {
                // No DB setting yet — fall back to .env
                expectedReceiver = process.env.PAYMENT_RECEIVER_NAME || ''
                expectedAccount = process.env.PAYMENT_RECEIVER_ACCOUNT || ''
            }
        } catch {
            // DB error — fall back to .env
            expectedReceiver = process.env.PAYMENT_RECEIVER_NAME || ''
            expectedAccount = process.env.PAYMENT_RECEIVER_ACCOUNT || ''
        }

        // Collect ALL receiver-related text from EasySlip response
        const allReceiverParts = [
            receiverName,
            receiverAccount,
            receiverProxyName,
            receiverProxyValue,
            slipData?.receiver?.account?.bank?.short || '',
            slipData?.receiver?.account?.bank?.name || '',
        ]
        const allReceiverText = allReceiverParts.join(' ').toLowerCase()

        if (isLearningMode) {
            // AUTO-LEARN: Save receiver info from this slip
            const learnedName = receiverName || receiverProxyName || ''
            const learnedAccount = receiverAccount || receiverProxyValue || ''
            console.log(`[SlipVerify] 🎓 AUTO-LEARN — name: "${learnedName}", account: "${learnedAccount}"`)

            if (learnedName || learnedAccount) {
                try {
                    await prisma.siteSetting.upsert({
                        where: { key: 'payment_receiver' },
                        update: { value: JSON.stringify({ name: learnedName, account: learnedAccount, learnedAt: new Date().toISOString(), autoLearned: true }) },
                        create: { key: 'payment_receiver', value: JSON.stringify({ name: learnedName, account: learnedAccount, learnedAt: new Date().toISOString(), autoLearned: true }) },
                    })
                    console.log(`[SlipVerify] ✅ Receiver auto-saved to DB: "${learnedName}" / "${learnedAccount}"`)
                } catch (dbErr) {
                    console.error('[SlipVerify] Failed to auto-save receiver:', dbErr)
                }
            }
        } else if (expectedReceiver || expectedAccount) {
            // NORMAL MODE: Verify receiver matches
            console.log(`[SlipVerify] Receiver check — allText: "${allReceiverText}" | expected name: "${expectedReceiver}" account: "${expectedAccount}"`)

            const nameMatch = expectedReceiver && allReceiverText.includes(expectedReceiver.toLowerCase())
            const accountMatch = expectedAccount && allReceiverText.includes(expectedAccount.toLowerCase())

            if (!nameMatch && !accountMatch) {
                console.error('[SlipVerify] RECEIVER MISMATCH — raw receiver:', JSON.stringify(slipData?.receiver))
                return NextResponse.json({
                    error: `สลิปนี้ไม่ได้โอนให้ SKIBKK (ผู้รับ: ${receiverName || receiverProxyName || receiverAccount || 'ไม่ทราบ'})`,
                    verified: false,
                }, { status: 400 })
            }
        }

        // ============ STEP 7: Verify slip is recent (within 20 minutes) ============
        if (date) {
            const slipDate = new Date(date)
            // Guard against invalid date parsing
            if (isNaN(slipDate.getTime())) {
                console.error('[SlipVerify] Invalid date from EasySlip:', date)
                // Don't block — just log and continue
            } else {
                const now = new Date()
                const diffMinutes = (now.getTime() - slipDate.getTime()) / (1000 * 60)
                console.log(`[SlipVerify] Time check — slip: ${date}, now: ${now.toISOString()}, diff: ${diffMinutes.toFixed(1)} min`)

                if (diffMinutes > 20) {
                    return NextResponse.json({
                        error: `สลิปนี้เก่าเกินไป (${date}) กรุณาโอนเงินใหม่ภายใน 20 นาที`,
                        verified: false,
                    }, { status: 400 })
                }
                if (diffMinutes < -5) {
                    return NextResponse.json({
                        error: 'วันที่ในสลิปไม่ถูกต้อง',
                        verified: false,
                    }, { status: 400 })
                }
            }
        }

        // ============ STEP 8: Return success ============
        console.log(`[SlipVerify] ✅ VERIFIED — amount: ${amount}, sender: ${sender}, transRef: ${transRef}`)

        return NextResponse.json({
            verified: true,
            amount: parseFloat(String(amount)),
            transRef,
            sender,
            receiver: receiverName || receiverProxyName,
            date,
            bankCode,
        })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('[SlipVerify] Unexpected error:', error)
        return NextResponse.json({
            error: 'เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาลองใหม่อีกครั้ง',
            verified: false,
        }, { status: 500 })
    }
}
