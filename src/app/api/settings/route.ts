import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/settings — read all site settings (public)
export async function GET() {
    try {
        const settings = await prisma.siteSetting.findMany()
        const result: Record<string, string> = {}
        for (const s of settings) {
            result[s.key] = s.value
        }
        return NextResponse.json(result)
    } catch (error) {
        console.error('GET /api/settings error:', error)
        return NextResponse.json({}, { status: 500 })
    }
}

// PUT /api/settings — upsert a setting by key (admin only)
export async function PUT(req: NextRequest) {
    try {
        const { key, value } = await req.json()

        if (!key || value === undefined) {
            return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
        }

        const setting = await prisma.siteSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        })

        return NextResponse.json(setting)
    } catch (error) {
        console.error('PUT /api/settings error:', error)
        return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
    }
}
