'use client'

import { FadeIn } from '@/components/Motion'
import DatePickerInput from '@/components/DatePickerInput'

import { useState, useEffect, useCallback } from 'react'
import { Star, BarChart3, Copy, Link, MessageSquare, Users, TrendingUp, Calendar, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface TeacherStat {
    id: string; name: string; specialty: string | null
    submitted: number
    avgTraining: number; avgComm: number; avgDedication: number
    avgService: number; avgVenue: number; avgOverall: number
}
interface Evaluation {
    id: string; teacherId: string; evaluatorName: string | null
    trainingQuality: number | null; communication: number | null; dedication: number | null
    serviceRating: number | null; venueRating: number | null; comebackPref: number | null
    rating: number; comment: string | null; submittedAt: string
    teacher: { name: string }
}

const ratingLabels = ['', 'ปรับปรุง', 'พอใช้', 'ดี', 'ดีมาก']
const comebackLabels = ['', 'ไม่ต้องการ', 'ไม่แน่ใจ', 'ต้องการ']

export default function EvaluationsPage() {
    const [stats, setStats] = useState<TeacherStat[]>([])
    const [evaluations, setEvaluations] = useState<Evaluation[]>([])
    const [teachers, setTeachers] = useState<Array<{ id: string; name: string }>>([])
    const [loading, setLoading] = useState(true)
    const [selectedTeacher, setSelectedTeacher] = useState('')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [createTeacherId, setCreateTeacherId] = useState('')
    const [generatedUrl, setGeneratedUrl] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    const fetchEvaluations = useCallback(() => {
        setLoading(true)
        const params = new URLSearchParams()
        if (dateFrom) params.set('from', dateFrom)
        if (dateTo) params.set('to', dateTo)
        const qs = params.toString() ? `?${params.toString()}` : ''

        Promise.all([
            fetch(`/api/evaluations${qs}`).then(r => r.json()),
            fetch('/api/teachers').then(r => r.json()),
        ]).then(([evalData, teachersData]) => {
            setStats(evalData.teacherStats || [])
            setEvaluations(evalData.evaluations || [])
            setTeachers(teachersData.teachers || [])
        }).catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
            .finally(() => setLoading(false))
    }, [dateFrom, dateTo])

    useEffect(() => {
        fetchEvaluations()
    }, [fetchEvaluations])

    const handleCreateLink = async () => {
        if (!createTeacherId) { toast.error('กรุณาเลือกเทรนเนอร์'); return }
        try {
            const res = await fetch('/api/evaluations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId: createTeacherId }),
            })
            const data = await res.json()
            if (res.ok) {
                setGeneratedUrl(data.url)
                toast.success('สร้างลิงก์แบบประเมินแล้ว')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาด')
        }
    }

    const copyUrl = () => {
        navigator.clipboard.writeText(generatedUrl)
        toast.success('คัดลอกลิงก์แล้ว')
    }

    const filteredEvals = selectedTeacher
        ? evaluations.filter(e => e.teacherId === selectedTeacher)
        : evaluations

    const renderStars = (val: number) => {
        if (!val) return <span style={{ color: 'var(--a-text-muted)' }}>-</span>
        return (
            <span style={{
                fontWeight: 700, fontSize: '14px',
                color: val >= 3.5 ? '#00b894' : val >= 2.5 ? '#f5a623' : '#e17055',
            }}>
                {val.toFixed(1)} <span style={{ fontSize: '11px' }}>{ratingLabels[Math.round(val)]}</span>
            </span>
        )
    }

    if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--a-text-muted)' }}>กำลังโหลด...</div>

    return (
        <FadeIn><div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>แบบประเมินเทรนเนอร์</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>สร้างลิงก์แบบประเมินและดูผลคะแนนเฉลี่ย</p>
                </div>
                <button onClick={() => { setShowCreateModal(true); setGeneratedUrl('') }} className="btn-admin"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Link size={16} /> สร้างลิงก์แบบประเมิน
                </button>
            </div>

            {/* Teacher Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                {stats.map(t => {
                    const overall = [t.avgTraining, t.avgComm, t.avgDedication].filter(v => v > 0)
                    const avgTeacher = overall.length > 0 ? overall.reduce((a, b) => a + b, 0) / overall.length : 0
                    return (
                        <div key={t.id} className="admin-card" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '12px',
                                    background: '#f5a623', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontWeight: 800, fontSize: '18px',
                                }}>
                                    {t.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--a-text)' }}>{t.name}</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>{t.specialty || 'เทรนเนอร์'} • {t.submitted} รีวิว</p>
                                </div>
                                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                    <div style={{
                                        fontSize: '24px', fontWeight: 900, fontFamily: "'Inter'",
                                        color: avgTeacher >= 3 ? '#00b894' : avgTeacher >= 2 ? '#f5a623' : '#e17055',
                                    }}>
                                        {avgTeacher > 0 ? avgTeacher.toFixed(1) : '-'}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}>คะแนนรวม</div>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--a-text-secondary)' }}>ฝึกสอน</span>
                                    {renderStars(t.avgTraining)}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--a-text-secondary)' }}>สื่อสาร</span>
                                    {renderStars(t.avgComm)}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--a-text-secondary)' }}>ใส่ใจ</span>
                                    {renderStars(t.avgDedication)}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--a-text-secondary)' }}>บริการ</span>
                                    {renderStars(t.avgService)}
                                </div>
                            </div>
                        </div>
                    )
                })}
                {stats.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--a-text-muted)' }}>
                        <BarChart3 size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                        <p style={{ fontWeight: 600 }}>ยังไม่มีข้อมูลเทรนเนอร์</p>
                    </div>
                )}
            </div>

            {/* Evaluation History */}
            <div className="admin-card">
                <div className="admin-card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
                    <h3 className="admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageSquare size={18} /> รายการแบบประเมินที่ส่งแล้ว ({filteredEvals.length})
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {/* Date Range Filter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={15} style={{ color: 'var(--a-text-muted)', flexShrink: 0 }} />
                            <DatePickerInput
                                value={dateFrom}
                                onChange={setDateFrom}
                                placeholder="จากวันที่"
                                style={{ width: '140px' }}
                            />
                            <span style={{ color: 'var(--a-text-muted)', fontSize: '13px', fontWeight: 600 }}>ถึง</span>
                            <DatePickerInput
                                value={dateTo}
                                onChange={setDateTo}
                                placeholder="ถึงวันที่"
                                style={{ width: '140px' }}
                            />
                            {(dateFrom || dateTo) && (
                                <button
                                    onClick={() => { setDateFrom(''); setDateTo('') }}
                                    title="ล้างตัวกรองวันที่"
                                    style={{
                                        background: 'rgba(225, 112, 85, 0.12)', border: '1px solid rgba(225, 112, 85, 0.3)',
                                        borderRadius: '6px', cursor: 'pointer', padding: '5px 8px',
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        color: '#e17055', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
                                    }}
                                >
                                    <X size={13} /> ล้าง
                                </button>
                            )}
                        </div>
                        {/* Teacher Filter */}
                        <select className="admin-input" style={{ width: '180px' }}
                            value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)}>
                            <option value="">ทุกเทรนเนอร์</option>
                            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                </div>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>วันที่</th>
                            <th>ผู้ประเมิน</th>
                            <th>เทรนเนอร์</th>
                            <th>ฝึกสอน</th>
                            <th>สื่อสาร</th>
                            <th>ใส่ใจ</th>
                            <th>บริการ</th>
                            <th>สถานที่</th>
                            <th>เรียนซ้ำ</th>
                            <th>ข้อเสนอแนะ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEvals.length === 0 ? (
                            <tr>
                                <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>
                                    ยังไม่มีแบบประเมินที่ส่งแล้ว
                                </td>
                            </tr>
                        ) : filteredEvals.map(ev => (
                            <tr key={ev.id}>
                                <td style={{ fontSize: '13px' }}>{new Date(ev.submittedAt).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                <td>{ev.evaluatorName || '-'}</td>
                                <td style={{ fontWeight: 600 }}>{ev.teacher.name}</td>
                                <td>{ratingLabels[ev.trainingQuality || 0] || '-'}</td>
                                <td>{ratingLabels[ev.communication || 0] || '-'}</td>
                                <td>{ratingLabels[ev.dedication || 0] || '-'}</td>
                                <td>{ratingLabels[ev.serviceRating || 0] || '-'}</td>
                                <td>{ratingLabels[ev.venueRating || 0] || '-'}</td>
                                <td style={{ color: ev.comebackPref === 3 ? '#00b894' : ev.comebackPref === 1 ? '#e17055' : '#f5a623' }}>
                                    {comebackLabels[ev.comebackPref || 0] || '-'}
                                </td>
                                <td style={{ maxWidth: '200px', fontSize: '12px', color: 'var(--a-text-secondary)' }}>
                                    {ev.comment || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Link Modal */}
            {showCreateModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
                }} onClick={() => setShowCreateModal(false)}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '90%' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: 'var(--a-text)' }}>
                            สร้างลิงก์แบบประเมิน
                        </h3>
                        <div className="input-group" style={{ marginBottom: '16px' }}>
                            <label style={{ color: 'var(--a-text-secondary)', fontSize: '14px', fontWeight: 600 }}>เลือกเทรนเนอร์</label>
                            <select className="admin-input" value={createTeacherId} onChange={e => setCreateTeacherId(e.target.value)}>
                                <option value="">-- เลือก --</option>
                                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        {!generatedUrl ? (
                            <button onClick={handleCreateLink} className="btn-admin" style={{ width: '100%' }}>
                                สร้างลิงก์
                            </button>
                        ) : (
                            <div>
                                <p style={{ fontSize: '13px', fontWeight: 600, color: '#00b894', marginBottom: '8px' }}>✅ สร้างลิงก์สำเร็จ!</p>
                                <div style={{
                                    display: 'flex', gap: '8px', padding: '10px', background: '#f5f6fa',
                                    borderRadius: '8px', border: '1px solid var(--a-border)',
                                }}>
                                    <input className="admin-input" value={generatedUrl} readOnly style={{ flex: 1, fontSize: '12px' }} />
                                    <button onClick={copyUrl} className="btn-admin" style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                                        <Copy size={14} /> คัดลอก
                                    </button>
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--a-text-muted)', marginTop: '8px' }}>
                                    ส่งลิงก์นี้ให้ลูกค้าเพื่อประเมินเทรนเนอร์
                                </p>
                            </div>
                        )}
                        <button onClick={() => setShowCreateModal(false)}
                            style={{ marginTop: '16px', background: 'none', border: 'none', color: 'var(--a-text-muted)', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>
                            ปิด
                        </button>
                    </div>
                </div>
            )}
        </div></FadeIn>
    )
}
