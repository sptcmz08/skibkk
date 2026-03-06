import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/qr-settings — get QR image + receiver info
export async function GET() {
    try {
        const [qrSetting, receiverSetting] = await Promise.all([
            prisma.siteSetting.findUnique({ where: { key: 'payment_qr_image' } }),
            prisma.siteSetting.findUnique({ where: { key: 'payment_receiver' } }),
        ])

        const qrImage = qrSetting?.value || null
        let receiver = null
        try {
            receiver = receiverSetting ? JSON.parse(receiverSetting.value) : null
        } catch { /* ignore */ }

        return NextResponse.json({
            qrImage,
            receiver,
            status: receiver?.name ? 'ready' : (qrImage ? 'learning' : 'no_qr'),
        })
    } catch (error) {
        console.error('GET /api/admin/qr-settings error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// POST /api/admin/qr-settings — upload new QR image (SUPERUSER only)
export async function POST(req: NextRequest) {
    try {
        await requireRole('SUPERUSER')

        const { qrImage, resetReceiver } = await req.json()

        if (!qrImage) {
            return NextResponse.json({ error: 'กรุณาอัปโหลดรูป QR Code' }, { status: 400 })
        }

        // Save QR image to DB
        await prisma.siteSetting.upsert({
            where: { key: 'payment_qr_image' },
            update: { value: qrImage },
            create: { key: 'payment_qr_image', value: qrImage },
        })

        // Reset receiver info (enter learning mode) — auto-learn from next successful slip
        if (resetReceiver !== false) {
            await prisma.siteSetting.upsert({
                where: { key: 'payment_receiver' },
                update: { value: JSON.stringify({ name: '', account: '', learnedAt: null, autoLearned: false }) },
                create: { key: 'payment_receiver', value: JSON.stringify({ name: '', account: '', learnedAt: null, autoLearned: false }) },
            })
        }

        console.log('[QR Settings] New QR uploaded, receiver reset to learning mode')

        return NextResponse.json({
            success: true,
            status: resetReceiver !== false ? 'learning' : 'ready',
            message: resetReceiver !== false
                ? 'อัปโหลด QR สำเร็จ! ระบบจะเรียนรู้ผู้รับจากสลิปแรกอัตโนมัติ'
                : 'อัปโหลด QR สำเร็จ!',
        })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('POST /api/admin/qr-settings error:', error)
        return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
    }
}
