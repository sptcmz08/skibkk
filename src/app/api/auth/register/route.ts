import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, createToken } from '@/lib/auth'
import { z } from 'zod'

const registerSchema = z.object({
    email: z.string().email('อีเมลไม่ถูกต้อง'),
    password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
    name: z.string().min(1, 'กรุณาระบุชื่อ'),
    phone: z.string().min(9, 'กรุณาระบุเบอร์โทรศัพท์ที่ถูกต้อง'),
})

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const data = registerSchema.parse(body)

        // Check duplicate email
        const existingEmail = await prisma.user.findUnique({ where: { email: data.email } })
        if (existingEmail) {
            return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }, { status: 400 })
        }

        // Check duplicate phone
        const existingPhone = await prisma.user.findUnique({ where: { phone: data.phone } })
        if (existingPhone) {
            return NextResponse.json({ error: 'เบอร์โทรนี้ถูกใช้งานแล้ว' }, { status: 400 })
        }

        const hashedPassword = await hashPassword(data.password)
        const user = await prisma.user.create({
            data: {
                email: data.email,
                password: hashedPassword,
                name: data.name,
                phone: data.phone,
            },
        })

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
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
        }
        console.error('Register error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
