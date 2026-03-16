import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

// GET — admin: get all evaluations or create evaluation link
// POST — public: submit evaluation
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const token = searchParams.get('token')

        // Public: get evaluation form data by token
        if (token) {
            const evaluation = await prisma.teacherEvaluation.findUnique({
                where: { token },
                include: { teacher: { select: { name: true, specialty: true } } },
            })
            if (!evaluation) {
                return NextResponse.json({ error: 'ไม่พบแบบประเมิน' }, { status: 404 })
            }
            if (evaluation.isSubmitted) {
                return NextResponse.json({ error: 'already_submitted', message: 'แบบประเมินนี้ถูกส่งแล้ว' }, { status: 400 })
            }
            return NextResponse.json({ evaluation })
        }

        // Admin: get all evaluations
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const evaluations = await prisma.teacherEvaluation.findMany({
            where: { isSubmitted: true },
            include: { teacher: { select: { id: true, name: true, specialty: true } } },
            orderBy: { submittedAt: 'desc' },
        })

        // Calculate averages per teacher
        const teachers = await prisma.teacher.findMany({ where: { isActive: true } })
        const teacherStats = teachers.map(t => {
            const evals = evaluations.filter(e => e.teacherId === t.id)
            const submitted = evals.length
            if (submitted === 0) return { ...t, submitted: 0, avgTraining: 0, avgComm: 0, avgDedication: 0, avgService: 0, avgVenue: 0, avgOverall: 0 }

            const avg = (field: string) => {
                const vals = evals.map(e => (e as Record<string, unknown>)[field]).filter((v): v is number => typeof v === 'number' && v > 0)
                return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
            }

            return {
                ...t,
                submitted,
                avgTraining: avg('trainingQuality'),
                avgComm: avg('communication'),
                avgDedication: avg('dedication'),
                avgService: avg('serviceRating'),
                avgVenue: avg('venueRating'),
                avgOverall: avg('rating'),
            }
        })

        return NextResponse.json({ evaluations, teacherStats })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('GET /api/evaluations error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}

// POST — submit evaluation (public) or create evaluation link (admin)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        // Submit evaluation (public)
        if (body.token) {
            const evaluation = await prisma.teacherEvaluation.findUnique({ where: { token: body.token } })
            if (!evaluation) return NextResponse.json({ error: 'ไม่พบแบบประเมิน' }, { status: 404 })
            if (evaluation.isSubmitted) return NextResponse.json({ error: 'แบบประเมินนี้ถูกส่งแล้ว' }, { status: 400 })

            const ratings = [body.trainingQuality, body.communication, body.dedication, body.serviceRating, body.venueRating]
                .filter((r: number) => r && r > 0)
            const avgRating = ratings.length > 0 ? Math.round(ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) : 0

            const updated = await prisma.teacherEvaluation.update({
                where: { token: body.token },
                data: {
                    evaluatorName: body.evaluatorName || null,
                    trainingQuality: body.trainingQuality || null,
                    communication: body.communication || null,
                    dedication: body.dedication || null,
                    serviceRating: body.serviceRating || null,
                    venueRating: body.venueRating || null,
                    comebackPref: body.comebackPref || null,
                    rating: avgRating,
                    comment: body.comment || null,
                    isSubmitted: true,
                    submittedAt: new Date(),
                },
            })

            return NextResponse.json({ success: true, evaluation: updated })
        }

        // Create evaluation link (admin)
        const user = await requireAuth()
        if (!['ADMIN', 'SUPERUSER', 'STAFF'].includes(user.role)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
        }

        const evaluation = await prisma.teacherEvaluation.create({
            data: {
                teacherId: body.teacherId,
                bookingId: body.bookingId || null,
            },
        })

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://skibkk.com'
        const evaluationUrl = `${baseUrl}/evaluate/${evaluation.token}`

        return NextResponse.json({ evaluation, url: evaluationUrl }, { status: 201 })
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
        }
        console.error('POST /api/evaluations error:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
