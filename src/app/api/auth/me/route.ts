import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const user = await getCurrentUser()
        const headers = {
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
            Pragma: 'no-cache',
        }
        if (!user) {
            return NextResponse.json({ user: null }, { status: 401, headers })
        }
        return NextResponse.json({ user }, { headers })
    } catch {
        return NextResponse.json({ user: null }, { status: 401 })
    }
}

export async function PUT(req: NextRequest) {
    try {
        const user = await requireAuth()
        const body = await req.json()
        const nextFirstName = typeof body.firstName === 'string' ? body.firstName.trim() : (user.firstName || '')
        const nextLastName = typeof body.lastName === 'string' ? body.lastName.trim() : (user.lastName || '')
        const nextName = [nextFirstName, nextLastName].filter(Boolean).join(' ').trim() || user.name
        const nextEmail = typeof body.email === 'string' ? body.email.trim() : user.email
        const nextPhone = typeof body.phone === 'string' ? body.phone.trim() : user.phone

        if (!nextFirstName || !nextLastName || !nextEmail || !nextPhone) {
            return NextResponse.json({ error: 'กรุณากรอกชื่อจริง นามสกุล อีเมล และเบอร์โทรให้ครบ' }, { status: 400 })
        }

        const duplicate = await prisma.user.findFirst({
            where: {
                id: { not: user.id },
                OR: [
                    { email: nextEmail },
                    { phone: nextPhone },
                ],
            },
            select: { id: true, email: true, phone: true },
        })

        if (duplicate) {
            if (duplicate.email === nextEmail) {
                return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }, { status: 409 })
            }
            if (duplicate.phone === nextPhone) {
                return NextResponse.json({ error: 'เบอร์โทรนี้ถูกใช้งานแล้ว' }, { status: 409 })
            }
        }

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: {
                name: nextName,
                firstName: nextFirstName,
                lastName: nextLastName,
                email: nextEmail,
                phone: nextPhone,
            },
            select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                lineDisplayName: true,
                lineAvatar: true,
            },
        })

        return NextResponse.json({ user: updated })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
            return NextResponse.json({ error: 'อีเมลหรือเบอร์โทรนี้ถูกใช้งานแล้ว' }, { status: 409 })
        }
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
