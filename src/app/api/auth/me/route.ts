import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, requireAuth, createToken } from '@/lib/auth'
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

        // Fetch current user with LINE info
        const currentUserWithLine = await prisma.user.findUnique({
            where: { id: user.id },
            select: { id: true, lineUserId: true, lineDisplayName: true, lineAvatar: true },
        })

        const duplicate = await prisma.user.findFirst({
            where: {
                id: { not: user.id },
                OR: [
                    { email: nextEmail },
                    { phone: nextPhone },
                ],
            },
            select: { id: true, email: true, phone: true, password: true, lineUserId: true, lineDisplayName: true, lineAvatar: true, role: true, isActive: true },
        })

        if (duplicate) {
            // Check if we can merge the current temporary LINE account with the existing customer record
            // Allow merge when:
            // 1. Duplicate is an active customer, AND
            // 2. Duplicate has no password (admin-created placeholder) OR has no LINE account linked OR same LINE account
            const isAdminCreatedPlaceholder = !duplicate.password
            const hasNoLineOrSameLine = duplicate.lineUserId === null || duplicate.lineUserId === '' || duplicate.lineUserId === currentUserWithLine?.lineUserId
            const canMerge = duplicate.role === 'CUSTOMER' &&
                duplicate.isActive &&
                (isAdminCreatedPlaceholder || hasNoLineOrSameLine)

            if (canMerge && currentUserWithLine) {
                // Determine LINE profile to transfer
                const lineUserId = currentUserWithLine.lineUserId || duplicate.lineUserId || null
                const lineDisplayName = currentUserWithLine.lineDisplayName || duplicate.lineDisplayName || null
                const lineAvatar = currentUserWithLine.lineAvatar || duplicate.lineAvatar || null

                // 1. Update duplicate user (migrated record) with new profile and LINE credentials
                const updatedDuplicate = await prisma.user.update({
                    where: { id: duplicate.id },
                    data: {
                        name: nextName,
                        firstName: nextFirstName,
                        lastName: nextLastName,
                        email: nextEmail,
                        phone: nextPhone,
                        lineUserId,
                        lineDisplayName,
                        lineAvatar,
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

                // 2. Transfer all existing child records (bookings, payments, packages, logs) to the merged user
                await prisma.booking.updateMany({
                    where: { userId: user.id },
                    data: { userId: duplicate.id },
                })
                await prisma.payment.updateMany({
                    where: { userId: user.id },
                    data: { userId: duplicate.id },
                })
                await prisma.userPackage.updateMany({
                    where: { userId: user.id },
                    data: { userId: duplicate.id },
                })
                await prisma.auditLog.updateMany({
                    where: { userId: user.id },
                    data: { userId: duplicate.id },
                })

                // 3. Clean up the current temporary user record
                await prisma.user.delete({
                    where: { id: user.id },
                })

                // 4. Create new JWT token for the merged user
                const token = await createToken({
                    userId: updatedDuplicate.id,
                    role: updatedDuplicate.role,
                    email: updatedDuplicate.email,
                    name: updatedDuplicate.name,
                })

                // 5. Respond with updated user and set auth-token cookie to maintain session
                const response = NextResponse.json({ user: updatedDuplicate })
                response.cookies.set('auth-token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 7 * 24 * 60 * 60,
                    path: '/',
                })

                return response
            }

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
