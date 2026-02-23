import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const user = await getCurrentUser()
        const headers = {
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
            'Pragma': 'no-cache',
        }
        if (!user) {
            return NextResponse.json({ user: null }, { status: 401, headers })
        }
        return NextResponse.json({ user }, { headers })
    } catch {
        return NextResponse.json({ user: null }, { status: 401 })
    }
}
