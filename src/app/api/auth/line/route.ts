import { NextRequest, NextResponse } from 'next/server'

const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || ''
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skibkk.com'

export async function GET(req: NextRequest) {
    const returnUrl = req.nextUrl.searchParams.get('returnUrl') || '/courts'

    if (!LINE_CHANNEL_ID) {
        return NextResponse.json({ error: 'LINE Login is not configured' }, { status: 500 })
    }

    // Encode returnUrl in state parameter
    const state = Buffer.from(JSON.stringify({ returnUrl })).toString('base64url')
    const callbackUrl = `${BASE_URL}/api/auth/line/callback`

    const lineAuthUrl = new URL('https://access.line.me/oauth2/v2.1/authorize')
    lineAuthUrl.searchParams.set('response_type', 'code')
    lineAuthUrl.searchParams.set('client_id', LINE_CHANNEL_ID)
    lineAuthUrl.searchParams.set('redirect_uri', callbackUrl)
    lineAuthUrl.searchParams.set('state', state)
    lineAuthUrl.searchParams.set('scope', 'profile openid email')
    lineAuthUrl.searchParams.set('bot_prompt', 'aggressive')
    lineAuthUrl.searchParams.set('prompt', 'consent')

    return NextResponse.redirect(lineAuthUrl.toString())
}
