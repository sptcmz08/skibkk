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

const EMAIL_IN_USE_ERROR = 'อีเมลนี้ถูกใช้งานแล้ว'
const PHONE_IN_USE_ERROR = 'เบอร์โทรนี้ถูกใช้งานแล้ว'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const data = registerSchema.parse(body)
        const hashedPassword = await hashPassword(data.password)

        const [existingEmail, existingPhone] = await Promise.all([
            prisma.user.findUnique({
                where: { email: data.email },
                select: { id: true },
            }),
            prisma.user.findUnique({
                where: { phone: data.phone },
                select: {
                    id: true,
                    password: true,
                    role: true,
                    isActive: true,
                },
            }),
        ])

        if (existingEmail && existingEmail.id !== existingPhone?.id) {
            return NextResponse.json({ error: EMAIL_IN_USE_ERROR }, { status: 400 })
        }

        let user
        if (existingPhone) {
            const canClaimMigratedCustomer =
                existingPhone.role === 'CUSTOMER' &&
                existingPhone.isActive &&
                !existingPhone.password

            if (!canClaimMigratedCustomer) {
                return NextResponse.json({ error: PHONE_IN_USE_ERROR }, { status: 400 })
            }

            user = await prisma.user.update({
                where: { id: existingPhone.id },
                data: {
                    email: data.email,
                    password: hashedPassword,
                    name: data.name,
                    phone: data.phone,
                },
            })
        } else {
            user = await prisma.user.create({
                data: {
                    email: data.email,
                    password: hashedPassword,
                    name: data.name,
                    phone: data.phone,
                },
            })
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
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
        }
        console.error('Register error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
