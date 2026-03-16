import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createToken } from '@/lib/auth'

const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || ''
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || ''
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skibkk.com'

interface LineTokenResponse {
    access_token: string
    id_token?: string
    token_type: string
    expires_in: number
    refresh_token: string
    scope: string
}

interface LineProfile {
    userId: string
    displayName: string
    pictureUrl?: string
    statusMessage?: string
}

interface LineIdTokenPayload {
    email?: string
}

export async function GET(req: NextRequest) {
    try {
        const code = req.nextUrl.searchParams.get('code')
        const stateParam = req.nextUrl.searchParams.get('state')

        if (!code) {
            return NextResponse.redirect(`${BASE_URL}/login?error=line_auth_failed`)
        }

        // Decode returnUrl from state
        let returnUrl = '/courts'
        if (stateParam) {
            try {
                const stateData = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
                returnUrl = stateData.returnUrl || '/courts'
            } catch { /* ignore */ }
        }

        // Exchange code for access token
        const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: `${BASE_URL}/api/auth/line/callback`,
                client_id: LINE_CHANNEL_ID,
                client_secret: LINE_CHANNEL_SECRET,
            }),
        })

        if (!tokenRes.ok) {
            console.error('LINE token error:', await tokenRes.text())
            return NextResponse.redirect(`${BASE_URL}/login?error=line_token_failed`)
        }

        const tokenData: LineTokenResponse = await tokenRes.json()

        // Get user profile
        const profileRes = await fetch('https://api.line.me/v2/profile', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })

        if (!profileRes.ok) {
            console.error('LINE profile error:', await profileRes.text())
            return NextResponse.redirect(`${BASE_URL}/login?error=line_profile_failed`)
        }

        const profile: LineProfile = await profileRes.json()

        // Try to get email from id_token
        let email: string | null = null
        if (tokenData.id_token) {
            try {
                // Decode id_token (JWT) to get email
                const parts = tokenData.id_token.split('.')
                if (parts.length === 3) {
                    const payload: LineIdTokenPayload = JSON.parse(
                        Buffer.from(parts[1], 'base64url').toString()
                    )
                    email = payload.email || null
                }
            } catch { /* ignore */ }
        }

        // Check if LINE user already exists
        let user = await prisma.user.findUnique({
            where: { lineUserId: profile.userId },
        })

        if (user) {
            // Check if user is deactivated
            if (!user.isActive) {
                return NextResponse.redirect(`${BASE_URL}/login?error=account_disabled`)
            }
            // Existing LINE user — update profile and login
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    lineDisplayName: profile.displayName,
                    lineAvatar: profile.pictureUrl || null,
                },
            })
        } else if (email) {
            // Check if email already exists (link LINE to existing account)
            const existingByEmail = await prisma.user.findUnique({ where: { email } })
            if (existingByEmail) {
                if (!existingByEmail.isActive) {
                    return NextResponse.redirect(`${BASE_URL}/login?error=account_disabled`)
                }
                user = await prisma.user.update({
                    where: { id: existingByEmail.id },
                    data: {
                        lineUserId: profile.userId,
                        lineDisplayName: profile.displayName,
                        lineAvatar: profile.pictureUrl || null,
                    },
                })
            }
        }

        if (!user) {
            // Create new user from LINE profile
            // Generate a placeholder email and phone if not available
            const placeholderEmail = email || `line_${profile.userId}@line.local`
            const placeholderPhone = `LINE-${profile.userId.substring(0, 12)}`

            user = await prisma.user.create({
                data: {
                    email: placeholderEmail,
                    name: profile.displayName,
                    phone: placeholderPhone,
                    lineUserId: profile.userId,
                    lineDisplayName: profile.displayName,
                    lineAvatar: profile.pictureUrl || null,
                    // No password — LINE-only user
                },
            })

            // Redirect to profile page to complete registration (fill real phone/email)
            returnUrl = '/profile?complete=1'
        }

        // Create auth token
        const token = await createToken({
            userId: user.id,
            role: user.role,
            email: user.email,
            name: user.name,
        })

        const response = NextResponse.redirect(`${BASE_URL}${returnUrl}`)
        response.cookies.set('auth-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60,
            path: '/',
        })

        return response
    } catch (error) {
        console.error('LINE callback error:', error)
        return NextResponse.redirect(`${BASE_URL}/login?error=line_callback_failed`)
    }
}
