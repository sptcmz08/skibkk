'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Star, CheckCircle, Heart, Send } from 'lucide-react'
import toast from 'react-hot-toast'

const ratingLabels = ['', 'ปรับปรุง', 'พอใช้', 'ดี', 'ดีมาก']
const ratingColors = ['', '#f5576c', '#ffc107', '#38ef7d', '#f5a623']
const comebackLabels = ['', 'ไม่ต้องการ', 'ไม่แน่ใจ', 'ต้องการ']

export default function EvaluatePage() {
    const params = useParams()
    const router = useRouter()
    const token = params.token as string

    const [teacherName, setTeacherName] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitted, setSubmitted] = useState(false)
    const [sending, setSending] = useState(false)
    const [form, setForm] = useState({
        evaluatorName: '',
        trainingQuality: 0,
        communication: 0,
        dedication: 0,
        serviceRating: 0,
        venueRating: 0,
        comebackPref: 0,
        comment: '',
    })

    useEffect(() => {
        fetch(`/api/evaluations?token=${token}`)
            .then(r => r.json())
            .then(data => {
                if (data.error === 'already_submitted') {
                    setSubmitted(true)
                } else if (data.evaluation) {
                    setTeacherName(data.evaluation.teacher.name)
                } else {
                    toast.error('ลิงก์ไม่ถูกต้อง')
                    router.push('/')
                }
            })
            .catch(() => toast.error('เกิดข้อผิดพลาด'))
            .finally(() => setLoading(false))
    }, [token, router])

    const handleSubmit = async () => {
        if (!form.trainingQuality || !form.communication || !form.dedication) {
            toast.error('กรุณาประเมินเทรนเนอร์ให้ครบทุกหัวข้อ')
            return
        }
        setSending(true)
        try {
            const res = await fetch('/api/evaluations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, ...form }),
            })
            if (res.ok) {
                setSubmitted(true)
                toast.success('ส่งแบบประเมินสำเร็จ!')
            } else {
                const data = await res.json()
                toast.error(data.error || 'ส่งไม่สำเร็จ')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาด')
        } finally {
            setSending(false)
        }
    }

    const setRating = (field: string, value: number) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    if (loading) return <div className="loading-page"><div className="spinner" /></div>

    // Success screen
    if (submitted) {
        return (
            <div className="customer-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    style={{ textAlign: 'center', maxWidth: '400px' }}>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        background: 'var(--c-gradient-success)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 24px', boxShadow: '0 8px 32px rgba(56,239,125,0.3)',
                    }}>
                        <CheckCircle size={40} style={{ color: 'white' }} />
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '12px' }}>ขอบคุณสำหรับการประเมิน!</h1>
                    <p style={{ color: 'var(--c-text-secondary)', marginBottom: '32px' }}>
                        ความคิดเห็นของท่านช่วยให้เราพัฒนาบริการได้ดียิ่งขึ้น
                    </p>
                    <Heart size={32} style={{ color: 'var(--c-accent)', margin: '0 auto' }} />
                </motion.div>
            </div>
        )
    }

    // Rating component
    const RatingRow = ({ label, field, value }: { label: string; field: string; value: number }) => (
        <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: 'var(--c-text-secondary)' }}>{label}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3, 4].map(n => (
                    <button key={n} onClick={() => setRating(field, n)}
                        style={{
                            flex: 1, padding: '10px 4px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
                            background: value === n ? ratingColors[n] : 'var(--c-glass)',
                            color: value === n ? (n <= 2 ? 'white' : '#0a0a1a') : 'var(--c-text-muted)',
                            transform: value === n ? 'scale(1.05)' : 'scale(1)',
                            boxShadow: value === n ? `0 4px 15px ${ratingColors[n]}40` : 'none',
                        }}
                    >
                        {ratingLabels[n]}
                    </button>
                ))}
            </div>
        </div>
    )

    return (
        <div className="customer-layout" style={{ minHeight: '100vh', padding: '24px 16px 60px' }}>
            <div style={{ maxWidth: '540px', margin: '0 auto' }}>
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    style={{ textAlign: 'center', marginBottom: '32px', paddingTop: '20px' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '20px',
                        background: 'var(--c-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(245,166,35,0.3)',
                    }}>
                        <Star size={32} style={{ color: 'white' }} />
                    </div>
                    <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>
                        แบบประเมินความพึงพอใจ
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--c-text-secondary)', lineHeight: 1.6 }}>
                        กรุณาประเมินความพึงพอใจตามประสบการณ์ที่ท่านได้รับ<br />
                        เพื่อให้เราพัฒนาและปรับปรุงให้ดียิ่งขึ้น
                    </p>
                </motion.div>

                {/* Evaluator name */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    style={{
                        background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)', borderRadius: '18px',
                        padding: '22px', marginBottom: '16px',
                    }}>
                    <div style={{ display: 'grid', gap: '14px' }}>
                        <div className="input-group">
                            <label style={{ fontSize: '13px' }}>ชื่อผู้เรียน <span style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>(ไม่บังคับ)</span></label>
                            <input className="input-field" placeholder="ชื่อ-สกุล" value={form.evaluatorName}
                                onChange={e => setForm(prev => ({ ...prev, evaluatorName: e.target.value }))} />
                        </div>
                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--c-text-secondary)' }}>ชื่อเทรนเนอร์</label>
                            <div style={{
                                padding: '12px 16px', borderRadius: '8px', marginTop: '6px',
                                background: 'rgba(245,166,35,0.1)', fontWeight: 700, fontSize: '16px',
                                color: 'var(--c-primary-light)',
                            }}>
                                {teacherName}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Trainer ratings */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    style={{
                        background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)', borderRadius: '18px',
                        padding: '22px', marginBottom: '16px',
                    }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        ⛷️ ประเมินเทรนเนอร์
                    </h3>
                    <RatingRow label="คุณภาพการฝึกสอนของเทรนเนอร์" field="trainingQuality" value={form.trainingQuality} />
                    <RatingRow label="การสื่อสาร" field="communication" value={form.communication} />
                    <RatingRow label="ความใส่ใจ และ ความตั้งใจในการสอน" field="dedication" value={form.dedication} />
                </motion.div>

                {/* Comeback preference */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    style={{
                        background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)', borderRadius: '18px',
                        padding: '22px', marginBottom: '16px',
                    }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--c-text-secondary)' }}>
                        หากมีการเรียนอีกครั้ง ต้องการเรียนกับเทรนเนอร์คนเดิมหรือไม่?
                    </h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { val: 3, label: 'ต้องการ', color: '#38ef7d' },
                            { val: 2, label: 'ไม่แน่ใจ', color: '#ffc107' },
                            { val: 1, label: 'ไม่ต้องการ', color: '#f5576c' },
                        ].map(opt => (
                            <button key={opt.val} onClick={() => setRating('comebackPref', opt.val)}
                                style={{
                                    flex: 1, padding: '12px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                                    fontFamily: 'inherit', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s',
                                    background: form.comebackPref === opt.val ? opt.color : 'var(--c-glass)',
                                    color: form.comebackPref === opt.val ? (opt.val === 2 ? '#0a0a1a' : 'white') : 'var(--c-text-muted)',
                                    transform: form.comebackPref === opt.val ? 'scale(1.05)' : 'scale(1)',
                                    boxShadow: form.comebackPref === opt.val ? `0 4px 15px ${opt.color}40` : 'none',
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Service & Venue */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                    style={{
                        background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)', borderRadius: '18px',
                        padding: '22px', marginBottom: '16px',
                    }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🏔️ ประเมินทั่วไป
                    </h3>
                    <RatingRow label="การบริการ" field="serviceRating" value={form.serviceRating} />
                    <RatingRow label="สถานที่" field="venueRating" value={form.venueRating} />
                </motion.div>

                {/* Comment */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    style={{
                        background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)', borderRadius: '18px',
                        padding: '22px', marginBottom: '24px',
                    }}>
                    <div className="input-group">
                        <label style={{ fontSize: '14px', fontWeight: 600 }}>💬 ข้อเสนอแนะ</label>
                        <textarea
                            className="input-field"
                            rows={3}
                            placeholder="ข้อเสนอแนะเพิ่มเติม (ถ้ามี)"
                            value={form.comment}
                            onChange={e => setForm(prev => ({ ...prev, comment: e.target.value }))}
                            style={{ resize: 'vertical' }}
                        />
                    </div>
                </motion.div>

                {/* Submit */}
                <motion.button
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    disabled={sending}
                    className="btn btn-primary btn-lg btn-block"
                    style={{ marginBottom: '40px' }}
                >
                    {sending ? <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
                        : <><Send size={18} /> ส่งแบบประเมิน</>}
                </motion.button>
            </div>
        </div>
    )
}
