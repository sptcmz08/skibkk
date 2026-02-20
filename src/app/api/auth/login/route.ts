import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createToken } from '@/lib/auth'
import { z } from 'zod'

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
})

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const data = loginSchema.parse(body)

        const user = await prisma.user.findUnique({ where: { email: data.email } })
        if (!user) {
            return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
        }

        if (!user.isActive) {
            return NextResponse.json({ error: 'บัญชีถูกระงับการใช้งาน' }, { status: 403 })
        }

        const valid = await verifyPassword(data.password, user.password)
        if (!valid) {
            return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
        }

        const token = await createToken({
            userId: user.id,
            role: user.role,
            email: user.email,
            name: user.name,
        })

        const response = NextResponse.json({
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
        })

        response.cookies.set('auth-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60,
            path: '/',
        })

        return response
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
        }
        console.error('Login error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
