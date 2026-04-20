'use client'

import { FadeIn } from '@/components/Motion'

import { useState, useEffect } from 'react'
import { Users, Copy, ExternalLink, Search, CheckCircle, Send } from 'lucide-react'
import toast from 'react-hot-toast'

interface Teacher { id: string; name: string; specialty: string | null }
interface Participant {
    id: string; name: string; sportType: string; phone: string | null
    teacherId: string | null
    teacher: { id: string; name: string } | null
}
interface BookingData {
    id: string; bookingNumber: string; status: string; createdAt: string
    user: { name: string; email: string; phone: string; lineUserId: string | null }
    bookingItems: Array<{
        id: string
        court: { name: string }
        date: string
        startTime: string
        endTime: string
        teacherId: string | null
        evaluationSent: boolean
    }>
    participants: Participant[]
}

export default function ParticipantsPage() {
    const [bookings, setBookings] = useState<BookingData[]>([])
    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')
    const [sendingEvaluationId, setSendingEvaluationId] = useState<string | null>(null)

    const loadData = () => {
        fetch('/api/participants')
            .then(r => r.json())
            .then(data => {
                setBookings(data.bookings || [])
                setTeachers(data.teachers || [])
            })
            .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
            .finally(() => setLoading(false))
    }

    useEffect(loadData, [])

    const handleAssign = async (participantId: string, teacherId: string) => {
        try {
            const res = await fetch('/api/participants', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ participantId, teacherId }),
            })
            const data = await res.json()
            if (res.ok) {
                toast.success(data.message)
                if (data.evaluationUrl) {
                    toast((t) => (
                        <div>
                            <p style={{ fontWeight: 600, marginBottom: '8px' }}>📝 ลิงก์แบบประเมินอัตโนมัติ</p>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => { navigator.clipboard.writeText(data.evaluationUrl); toast.dismiss(t.id); toast.success('คัดลอกลิงก์แล้ว') }}
                                    style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Copy size={12} /> คัดลอก
                                </button>
                                <button onClick={() => { window.open(data.evaluationUrl, '_blank'); toast.dismiss(t.id) }}
                                    style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#f5a623', color: 'white', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ExternalLink size={12} /> เปิด
                                </button>
                            </div>
                        </div>
                    ), { duration: 10000 })
                }
                loadData()
            } else {
                toast.error(data.error)
            }
        } catch {
            toast.error('เกิดข้อผิดพลาด')
        }
    }

    const handleSendEvaluation = async (bookingItemId: string) => {
        setSendingEvaluationId(bookingItemId)
        try {
            const res = await fetch('/api/evaluations/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingItemId }),
            })
            const data = await res.json()
            if (res.ok) {
                toast.success(data.message || 'ส่งแบบประเมินแล้ว')
                loadData()
            } else {
                toast.error(data.error || 'ส่งแบบประเมินไม่สำเร็จ')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาด')
        } finally {
            setSendingEvaluationId(null)
        }
    }

    const filteredBookings = bookings.filter(b => {
        const matchSearch = b.bookingNumber.toLowerCase().includes(search.toLowerCase()) ||
            b.user.name.toLowerCase().includes(search.toLowerCase()) ||
            b.participants.some(p => p.name.toLowerCase().includes(search.toLowerCase()))

        if (filter === 'assigned') return matchSearch && b.participants.every(p => p.teacherId)
        if (filter === 'unassigned') return matchSearch && b.participants.some(p => !p.teacherId)
        return matchSearch
    })

    const totalParticipants = bookings.reduce((s, b) => s + b.participants.length, 0)
    const assignedCount = bookings.reduce((s, b) => s + b.participants.filter(p => p.teacherId).length, 0)

    if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--a-text-muted)' }}>กำลังโหลด...</div>

    return (
        <FadeIn><div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>ผู้เรียน & ครูผู้สอน</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>เลือกครูผู้สอนให้ผู้เรียนแต่ละคน</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--a-text-muted)' }} />
                        <input className="admin-input" style={{ width: '220px', paddingLeft: '32px' }}
                            placeholder="ค้นหา..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="admin-input" style={{ width: '160px' }}
                        value={filter} onChange={e => setFilter(e.target.value as 'all' | 'assigned' | 'unassigned')}>
                        <option value="all">ทั้งหมด</option>
                        <option value="unassigned">ยังไม่เลือกครู</option>
                        <option value="assigned">เลือกครูแล้ว</option>
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
                <div className="admin-card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 900, fontFamily: "'Inter'", color: 'var(--a-primary)' }}>{totalParticipants}</div>
                    <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>ผู้เรียนทั้งหมด</div>
                </div>
                <div className="admin-card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 900, fontFamily: "'Inter'", color: '#00b894' }}>{assignedCount}</div>
                    <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>เลือกครูแล้ว</div>
                </div>
                <div className="admin-card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 900, fontFamily: "'Inter'", color: '#e17055' }}>{totalParticipants - assignedCount}</div>
                    <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>ยังไม่เลือก</div>
                </div>
            </div>

            {/* Bookings with participants */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredBookings.length === 0 ? (
                    <div className="admin-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--a-text-muted)' }}>
                        <Users size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                        <p style={{ fontWeight: 600 }}>ไม่พบรายการ</p>
                    </div>
                ) : filteredBookings.map(booking => (
                    <div key={booking.id} className="admin-card" style={{ padding: '20px' }}>
                        {/* Booking header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                                <span style={{ fontWeight: 800, fontFamily: "'Inter'", color: 'var(--a-primary)', fontSize: '15px' }}>
                                    #{booking.bookingNumber}
                                </span>
                                <span style={{ color: 'var(--a-text-muted)', fontSize: '13px', marginLeft: '12px' }}>
                                    {booking.user.name} • {new Date(booking.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                            {booking.bookingItems.map(item => {
                                const canSendEvaluation = booking.status === 'CONFIRMED'
                                    && Boolean(booking.user.lineUserId)
                                    && Boolean(item.teacherId || booking.participants.some(participant => participant.teacherId))
                                return (
                                    <div key={item.id} style={{
                                        border: '1px solid var(--a-border)',
                                        borderRadius: '8px',
                                        padding: '8px 10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        background: '#fff',
                                        fontSize: '12px',
                                    }}>
                                        <span style={{ color: 'var(--a-text-secondary)' }}>
                                            {item.court.name} {new Date(item.date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })} {item.startTime}-{item.endTime}
                                        </span>
                                        <button
                                            onClick={() => handleSendEvaluation(item.id)}
                                            disabled={!canSendEvaluation || sendingEvaluationId === item.id}
                                            className="btn-admin-outline"
                                            style={{
                                                padding: '5px 8px',
                                                fontSize: '11px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                opacity: !canSendEvaluation ? 0.5 : 1,
                                                cursor: !canSendEvaluation ? 'not-allowed' : 'pointer',
                                            }}
                                            title={!booking.user.lineUserId ? 'ลูกค้ายังไม่ได้เชื่อม LINE' : !canSendEvaluation ? 'ต้องยืนยัน booking และเลือกครูก่อน' : undefined}
                                        >
                                            <Send size={12} />
                                            {sendingEvaluationId === item.id ? 'กำลังส่ง...' : item.evaluationSent ? 'ส่งซ้ำ' : 'ส่งประเมิน'}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Participants table */}
                        <table className="admin-table" style={{ marginBottom: 0 }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '30px' }}>#</th>
                                    <th>ชื่อผู้เรียน</th>
                                    <th>ประเภทกีฬา</th>
                                    <th>เบอร์โทร</th>
                                    <th style={{ width: '220px' }}>ครูผู้สอน</th>
                                    <th style={{ width: '60px' }}>สถานะ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {booking.participants.map((p, idx) => (
                                    <tr key={p.id}>
                                        <td style={{ fontWeight: 600, color: 'var(--a-text-muted)' }}>{idx + 1}</td>
                                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                                        <td>{p.sportType}</td>
                                        <td style={{ fontSize: '13px' }}>{p.phone || '-'}</td>
                                        <td>
                                            <select
                                                className="admin-input"
                                                style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
                                                value={p.teacherId || ''}
                                                onChange={e => handleAssign(p.id, e.target.value)}
                                            >
                                                <option value="">-- เลือกครู --</option>
                                                {teachers.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}{t.specialty ? ` (${t.specialty})` : ''}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {p.teacherId ? (
                                                <CheckCircle size={18} style={{ color: '#00b894' }} />
                                            ) : (
                                                <span style={{ color: '#e17055', fontSize: '18px' }}>⏳</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div></FadeIn>
    )
}
