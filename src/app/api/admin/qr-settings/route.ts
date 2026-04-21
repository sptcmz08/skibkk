import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type ReceiverInfo = {
    name: string
    account: string
    learnedAt: string | null
    autoLearned: boolean
}

const emptyReceiver = (): ReceiverInfo => ({
    name: '',
    account: '',
    learnedAt: null,
    autoLearned: false,
})

const hasReceiverData = (receiver: ReceiverInfo | null | undefined) =>
    Boolean(receiver?.name.trim() || receiver?.account.trim())

// GET /api/admin/qr-settings - get QR image + receiver info
export async function GET() {
    try {
        const [qrSetting, receiverSetting] = await Promise.all([
            prisma.siteSetting.findUnique({ where: { key: 'payment_qr_image' } }),
            prisma.siteSetting.findUnique({ where: { key: 'payment_receiver' } }),
        ])

        const qrImage = qrSetting?.value || null
        let receiver: ReceiverInfo | null = null

        try {
            receiver = receiverSetting ? JSON.parse(receiverSetting.value) as ReceiverInfo : null
        } catch {
            receiver = null
        }

        return NextResponse.json({
            qrImage,
            receiver,
            status: hasReceiverData(receiver) ? 'ready' : (qrImage ? 'learning' : 'no_qr'),
        })
    } catch (error) {
        console.error('GET /api/admin/qr-settings error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// POST /api/admin/qr-settings - upload QR and/or save receiver info (SUPERUSER only)
export async function POST(req: NextRequest) {
    try {
        await requireRole('SUPERUSER')

        const body = await req.json()
        const qrImage = typeof body.qrImage === 'string' ? body.qrImage : ''
        const resetReceiver = body.resetReceiver === true
        const receiverInput = body.receiver && typeof body.receiver === 'object'
            ? body.receiver as Partial<ReceiverInfo>
            : null

        const receiver: ReceiverInfo | null = receiverInput
            ? {
                name: String(receiverInput.name || '').trim(),
                account: String(receiverInput.account || '').trim(),
                learnedAt: new Date().toISOString(),
                autoLearned: false,
            }
            : null

        if (!qrImage && !resetReceiver && !hasReceiverData(receiver)) {
            return NextResponse.json({
                error: 'กรุณาอัปโหลดรูป QR Code หรือกรอกข้อมูลบัญชีผู้รับ',
            }, { status: 400 })
        }

        if (qrImage) {
            await prisma.siteSetting.upsert({
                where: { key: 'payment_qr_image' },
                update: { value: qrImage },
                create: { key: 'payment_qr_image', value: qrImage },
            })
        }

        let nextReceiver: ReceiverInfo | null = null

        if (resetReceiver) {
            const cleared = emptyReceiver()
            await prisma.siteSetting.upsert({
                where: { key: 'payment_receiver' },
                update: { value: JSON.stringify(cleared) },
                create: { key: 'payment_receiver', value: JSON.stringify(cleared) },
            })
            nextReceiver = null
        }

        if (hasReceiverData(receiver)) {
            await prisma.siteSetting.upsert({
                where: { key: 'payment_receiver' },
                update: { value: JSON.stringify(receiver) },
                create: { key: 'payment_receiver', value: JSON.stringify(receiver) },
            })
            nextReceiver = receiver
        }

        const status = hasReceiverData(nextReceiver) ? 'ready' : (qrImage ? 'learning' : 'no_qr')
        const message = hasReceiverData(nextReceiver)
            ? 'บันทึกข้อมูลบัญชีผู้รับสำเร็จ'
            : qrImage && resetReceiver
                ? 'อัปโหลด QR สำเร็จ ระบบจะเรียนรู้ผู้รับจากสลิปแรกอัตโนมัติ'
                : qrImage
                    ? 'อัปโหลด QR สำเร็จ'
                    : 'รีเซ็ตข้อมูลผู้รับสำเร็จ'

        return NextResponse.json({
            success: true,
            status,
            receiver: nextReceiver,
            message,
        })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('POST /api/admin/qr-settings error:', error)
        return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
    }
}
