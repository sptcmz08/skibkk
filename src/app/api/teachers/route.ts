import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getCurrentUser } from '@/lib/auth'

// GET — list teachers (public for dropdowns, full for admin)
export async function GET() {
    try {
        const user = await getCurrentUser()
        const isAdmin = user && ['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)

        const teachers = await prisma.teacher.findMany({
            where: isAdmin ? {} : { isActive: true, workStatus: 'ACTIVE' },
            include: isAdmin ? {
                schedules: true,
                _count: { select: { evaluations: { where: { isSubmitted: true } }, participants: true } },
            } : undefined,
            orderBy: { name: 'asc' },
        })

        // Calculate avg rating for admin
        if (isAdmin) {
            const teacherIds = teachers.map(t => t.id)
            const evals = await prisma.teacherEvaluation.findMany({
                where: { teacherId: { in: teacherIds }, isSubmitted: true },
                select: { teacherId: true, trainingQuality: true, communication: true, dedication: true },
            })

            const enriched = teachers.map(t => {
                const tEvals = evals.filter(e => e.teacherId === t.id)
                let avgScore = 0
                if (tEvals.length > 0) {
                    const scores = tEvals.flatMap(e =>
                        [e.trainingQuality, e.communication, e.dedication].filter((v): v is number => v !== null && v > 0)
                    )
                    avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
                }
                return { ...t, avgScore, evalCount: tEvals.length }
            })
            return NextResponse.json({ teachers: enriched })
        }

        return NextResponse.json({ teachers })
    } catch (error) {
        console.error('GET /api/teachers error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// POST — create teacher
export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const body = await req.json()
        const teacher = await prisma.teacher.create({
            data: {
                name: body.name,
                phone: body.phone || null,
                email: body.email || null,
                specialty: body.specialty || null,
                workStatus: body.workStatus || 'ACTIVE',
                schedules: body.schedules?.length ? {
                    create: body.schedules.map((s: { dayOfWeek: string; startTime: string; endTime: string }) => ({
                        dayOfWeek: s.dayOfWeek,
                        startTime: s.startTime,
                        endTime: s.endTime,
                    })),
                } : undefined,
            },
            include: { schedules: true },
        })

        return NextResponse.json({ teacher }, { status: 201 })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        console.error('POST /api/teachers error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// PATCH — update teacher
export async function PATCH(req: NextRequest) {
    try {
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const body = await req.json()
        const { id, schedules, ...data } = body

        const teacher = await prisma.teacher.update({
            where: { id },
            data: {
                name: data.name,
                phone: data.phone || null,
                email: data.email || null,
                specialty: data.specialty || null,
                workStatus: data.workStatus || 'ACTIVE',
                isActive: data.workStatus !== 'SUSPENDED',
            },
        })

        // Update schedules if provided
        if (schedules) {
            await prisma.teacherSchedule.deleteMany({ where: { teacherId: id } })
            if (schedules.length > 0) {
                await prisma.teacherSchedule.createMany({
                    data: schedules.map((s: { dayOfWeek: string; startTime: string; endTime: string }) => ({
                        teacherId: id, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime,
                    })),
                })
            }
        }

        return NextResponse.json({ teacher })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        console.error('PATCH /api/teachers error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
