import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from './prisma'

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12)
}

export async function verifyPassword(
    password: string,
    hashedPassword: string
): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
}

export async function createToken(payload: {
    userId: string
    role: string
    email: string
    name: string
}): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .sign(JWT_SECRET)
}

export async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET)
        return payload as {
            userId: string
            role: string
            email: string
            name: string
        }
    } catch {
        return null
    }
}

export async function getCurrentUser() {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return null

    const payload = await verifyToken(token)
    if (!payload) return null

    const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
        },
    })

    return user
}

export async function isAdmin() {
    const user = await getCurrentUser()
    return user && ['ADMIN', 'SUPERUSER'].includes(user.role)
}

export async function requireAuth() {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')
    return user
}

export async function requireAdmin() {
    const user = await getCurrentUser()
    if (!user || !['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
        throw new Error('Forbidden')
    }
    return user
}
