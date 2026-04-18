import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getAuditRequestMeta } from '@/lib/audit'
import { isValidLineUserId } from '@/lib/line-messaging'

export const dynamic = 'force-dynamic'

const ADMIN_ROLES = new Set(['ADMIN', 'SUPERUSER', 'STAFF'])

const hasCode = (error: unknown, code: string): error is { code: string; meta?: { target?: string[] | string } } =>
    typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === code

const hasTargetField = (error: unknown, field: string) => {
    if (typeof error !== 'object' || error === null || !('meta' in error)) return false
    const target = (error as { meta?: { target?: string[] | string } }).meta?.target
    if (Array.isArray(target)) return target.includes(field)
    return target === field
}

const customerSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    isActive: true,
    lineUserId: true,
    lineDisplayName: true,
    lineAvatar: true,
    createdAt: true,
    _count: { select: { bookings: true } },
}

export async function GET(req: NextRequest) {
    try {
        const user = await requireAuth()
        if (!ADMIN_ROLES.has(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const search = searchParams.get('search')?.trim() || ''
        const takeParam = parseInt(searchParams.get('take') || '', 10)
        const take = Number.isFinite(takeParam) && takeParam > 0 ? Math.min(takeParam, 1000) : 100

        const customers = await prisma.user.findMany({
            where: {
                role: 'CUSTOMER',
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { phone: { contains: search } },
                        { lineUserId: { contains: search } },
                        { lineDisplayName: { contains: search, mode: 'insensitive' } },
                    ],
                }),
            },
            select: customerSelect,
            orderBy: { createdAt: 'desc' },
            take,
        })

        return NextResponse.json({ customers }, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
            },
        })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('Customers GET error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const user = await requireAuth()
        if (!ADMIN_ROLES.has(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const requestMeta = getAuditRequestMeta(req)
        const body = await req.json()
        const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const email = typeof body.email === 'string' ? body.email.trim() : ''
        const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
        const lineUserId = typeof body.lineUserId === 'string' ? body.lineUserId.trim() : ''

        if (!userId) return NextResponse.json({ error: 'ระบุลูกค้าไม่ถูกต้อง' }, { status: 400 })
        if (!name || !email || !phone) {
            return NextResponse.json({ error: 'กรุณากรอกชื่อ เบอร์โทร และอีเมล' }, { status: 400 })
        }
        if (lineUserId && !isValidLineUserId(lineUserId)) {
            return NextResponse.json({ error: 'LINE User ID สำหรับแจ้งเตือนต้องขึ้นต้นด้วย U และเป็นรหัสจาก LINE Login เท่านั้น' }, { status: 400 })
        }

        const existing = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                lineUserId: true,
                lineDisplayName: true,
            },
        })

        if (!existing || existing.role !== 'CUSTOMER') {
            return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 404 })
        }

        const customer = await prisma.user.update({
            where: { id: userId },
            data: {
                name,
                email,
                phone,
                lineUserId: lineUserId || null,
            },
            select: customerSelect,
        })

        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'CUSTOMER_UPDATE',
                entityType: 'user',
                entityId: userId,
                ipAddress: requestMeta.ipAddress,
                details: JSON.stringify({
                    before: {
                        name: existing.name,
                        email: existing.email,
                        phone: existing.phone,
                        lineUserId: existing.lineUserId,
                        lineDisplayName: existing.lineDisplayName,
                    },
                    after: {
                        name: customer.name,
                        email: customer.email,
                        phone: customer.phone,
                        lineUserId: customer.lineUserId,
                        lineDisplayName: customer.lineDisplayName,
                    },
                    request: requestMeta,
                }),
            },
        })

        return NextResponse.json({ customer })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        if (hasCode(error, 'P2002')) {
            if (hasTargetField(error, 'email')) {
                return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }, { status: 400 })
            }
            if (hasTargetField(error, 'phone')) {
                return NextResponse.json({ error: 'เบอร์โทรนี้ถูกใช้งานแล้ว' }, { status: 400 })
            }
            if (hasTargetField(error, 'lineUserId')) {
                return NextResponse.json({ error: 'Line ID นี้ถูกใช้งานแล้ว' }, { status: 400 })
            }
            return NextResponse.json({ error: 'ข้อมูลซ้ำกับผู้ใช้อื่น' }, { status: 400 })
        }

        console.error('Customers PATCH error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
