import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 400 })
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ PNG, JPG, WebP, GIF' }, { status: 400 })
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'ขนาดไฟล์ต้องไม่เกิน 5MB' }, { status: 400 })
        }

        // Ensure upload dir exists
        if (!existsSync(UPLOAD_DIR)) {
            await mkdir(UPLOAD_DIR, { recursive: true })
        }

        // Generate unique filename
        const ext = file.name.split('.').pop() || 'png'
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const filepath = path.join(UPLOAD_DIR, filename)

        // Write file
        const buffer = Buffer.from(await file.arrayBuffer())
        await writeFile(filepath, buffer)

        const url = `/uploads/${filename}`

        return NextResponse.json({ url, filename })
    } catch (error) {
        console.error('Upload error:', error)
        return NextResponse.json({ error: 'อัปโหลดไม่สำเร็จ' }, { status: 500 })
    }
}
