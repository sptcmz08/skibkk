import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
    ReceiverInfo,
    PaymentDisplayConfig,
    emptyReceiver,
    parseReceiver,
    parseDisplayConfig,
    computePaymentChannelStatus,
    isReceiverComplete,
} from '@/lib/payment-channel'

export const dynamic = 'force-dynamic'

// GET /api/admin/qr-settings - get payment display settings
export async function GET() {
    try {
        const [qrSetting, receiverSetting, displaySetting] = await Promise.all([
            prisma.siteSetting.findUnique({ where: { key: 'payment_qr_image' } }),
            prisma.siteSetting.findUnique({ where: { key: 'payment_receiver' } }),
            prisma.siteSetting.findUnique({ where: { key: 'payment_display_config' } }),
        ])

        const qrImage = qrSetting?.value || null
        const receiver = parseReceiver(receiverSetting?.value || null)
        const displayConfig = parseDisplayConfig(displaySetting?.value || null)

        return NextResponse.json({
            qrImage,
            receiver,
            displayConfig,
            status: computePaymentChannelStatus({ qrImage, receiver, displayConfig }).status,
        })
    } catch (error) {
        console.error('GET /api/admin/qr-settings error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// POST /api/admin/qr-settings - save QR / receiver / payment display config
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
                bankName: String(receiverInput.bankName || '').trim(),
                learnedAt: new Date().toISOString(),
                autoLearned: false,
            }
            : null

        const displayConfigInput = body.displayConfig && typeof body.displayConfig === 'object'
            ? body.displayConfig as Partial<PaymentDisplayConfig>
            : null
        const displayConfig = displayConfigInput
            ? {
                enableQrCode: displayConfigInput.enableQrCode !== false,
                enableBankDetails: displayConfigInput.enableBankDetails !== false,
            }
            : null

        if (receiver && !isReceiverComplete(receiver)) {
            return NextResponse.json({
                error: 'กรุณากรอกชื่อบัญชี เลขบัญชี และธนาคารให้ครบถ้วน',
            }, { status: 400 })
        }

        if (!qrImage && !resetReceiver && !receiver && !displayConfig) {
            return NextResponse.json({
                error: 'กรุณาระบุข้อมูลที่ต้องการบันทึก',
            }, { status: 400 })
        }

        let nextQrImage = (await prisma.siteSetting.findUnique({
            where: { key: 'payment_qr_image' },
        }))?.value || null
        const previousQrImage = nextQrImage

        if (qrImage) {
            await prisma.siteSetting.upsert({
                where: { key: 'payment_qr_image' },
                update: { value: qrImage },
                create: { key: 'payment_qr_image', value: qrImage },
            })
            nextQrImage = qrImage
        }

        let nextReceiver = parseReceiver((await prisma.siteSetting.findUnique({ where: { key: 'payment_receiver' } }))?.value || null)
        const qrImageChanged = Boolean(qrImage && qrImage !== previousQrImage)
        if (qrImageChanged && !receiver) {
            const cleared = emptyReceiver()
            await prisma.siteSetting.upsert({
                where: { key: 'payment_receiver' },
                update: { value: JSON.stringify(cleared) },
                create: { key: 'payment_receiver', value: JSON.stringify(cleared) },
            })
            nextReceiver = cleared
        }

        if (resetReceiver) {
            const cleared = emptyReceiver()
            await prisma.siteSetting.upsert({
                where: { key: 'payment_receiver' },
                update: { value: JSON.stringify(cleared) },
                create: { key: 'payment_receiver', value: JSON.stringify(cleared) },
            })
            nextReceiver = cleared
        }

        if (receiver) {
            await prisma.siteSetting.upsert({
                where: { key: 'payment_receiver' },
                update: { value: JSON.stringify(receiver) },
                create: { key: 'payment_receiver', value: JSON.stringify(receiver) },
            })
            nextReceiver = receiver
        }

        let nextDisplayConfig = parseDisplayConfig((await prisma.siteSetting.findUnique({ where: { key: 'payment_display_config' } }))?.value || null)
        if (displayConfig) {
            if (displayConfig.enableQrCode && !nextQrImage) {
                return NextResponse.json({
                    error: 'กรุณาอัปโหลดรูป QR Code หรือรูปช่องทางชำระเงินก่อนเปิดใช้งานรูปชำระเงิน',
                }, { status: 400 })
            }

            if (displayConfig.enableBankDetails && !isReceiverComplete(nextReceiver)) {
                return NextResponse.json({
                    error: 'กรุณากรอกชื่อบัญชี เลขบัญชี และธนาคารให้ครบก่อนเปิดใช้งานข้อมูลบัญชี',
                }, { status: 400 })
            }

            await prisma.siteSetting.upsert({
                where: { key: 'payment_display_config' },
                update: { value: JSON.stringify(displayConfig) },
                create: { key: 'payment_display_config', value: JSON.stringify(displayConfig) },
            })
            nextDisplayConfig = displayConfig
        }

        const status = computePaymentChannelStatus({
            qrImage: nextQrImage,
            receiver: nextReceiver,
            displayConfig: nextDisplayConfig,
        }).status

        return NextResponse.json({
            success: true,
            status,
            qrImage: nextQrImage,
            receiver: nextReceiver,
            displayConfig: nextDisplayConfig,
            message: qrImageChanged && !receiver
                ? 'อัปโหลดรูปสำเร็จ กรุณาตรวจสอบและบันทึกข้อมูลบัญชีใหม่ให้ตรงกับ QR ก่อนเปิดใช้งาน'
                : 'บันทึกการตั้งค่าชำระเงินสำเร็จ',
        })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('POST /api/admin/qr-settings error:', error)
        return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
    }
}
