import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — list audit logs (admin only)
export async function GET(req: NextRequest) {
    try {
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '50')
        const action = searchParams.get('action') || undefined
        const entityId = searchParams.get('entityId') || undefined
        const entityType = searchParams.get('entityType') || undefined

        const where: any = {}
        if (action) where.action = action
        if (entityId) where.entityId = entityId
        if (entityType) where.entityType = entityType

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    user: { select: { name: true, email: true, role: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.auditLog.count({ where }),
        ])

        return NextResponse.json({ logs, total, page, totalPages: Math.ceil(total / limit) })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('Audit logs error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
