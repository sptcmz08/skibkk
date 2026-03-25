'use client'

import { FadeIn } from '@/components/Motion'

import { useState, useEffect } from 'react'
import { GraduationCap, Plus, Star, Phone, Mail, Clock, X, Save, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const DAYS = [
    { key: 'MONDAY', label: 'จันทร์' }, { key: 'TUESDAY', label: 'อังคาร' },
    { key: 'WEDNESDAY', label: 'พุธ' }, { key: 'THURSDAY', label: 'พฤหัสบดี' },
    { key: 'FRIDAY', label: 'ศุกร์' }, { key: 'SATURDAY', label: 'เสาร์' }, { key: 'SUNDAY', label: 'อาทิตย์' },
]
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: 'ทำงาน', cls: 'badge-success' },
    ON_LEAVE: { label: 'ลาหยุด', cls: 'badge-warning' },
    SUSPENDED: { label: 'ระงับ', cls: 'badge-danger' },
}

interface Schedule { id?: string; dayOfWeek: string; startTime: string; endTime: string }
interface Teacher {
    id: string; name: string; phone: string | null; email: string | null
    specialty: string | null; workStatus: string; isActive: boolean
    schedules: Schedule[]; avgScore: number; evalCount: number
    _count: { evaluations: number; participants: number }
}

const emptyForm = { name: '', phone: '', email: '', specialty: '', workStatus: 'ACTIVE', schedules: [] as Schedule[] }

export default function TeachersPage() {
    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [sportTypes, setSportTypes] = useState<string[]>([])

    const loadData = () => {
        fetch('/api/teachers').then(r => r.json())
            .then(data => setTeachers(data.teachers || []))
            .catch(() => toast.error('โหลดไม่สำเร็จ'))
            .finally(() => setLoading(false))
    }
    useEffect(() => {
        loadData()
        fetch('/api/sport-types', { cache: 'no-store' }).then(r => r.json())
            .then(data => { if (data.sportTypes) setSportTypes(data.sportTypes) }).catch(() => {})
    }, [])

    const openCreate = () => { setEditId(null); setForm(emptyForm); setShowModal(true) }
    const openEdit = (t: Teacher) => {
        setEditId(t.id)
        setForm({
            name: t.name, phone: t.phone || '', email: t.email || '',
            specialty: t.specialty || '', workStatus: t.workStatus,
            schedules: t.schedules.map(s => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })),
        })
        setShowModal(true)
    }

    const addScheduleRow = () => setForm(f => ({ ...f, schedules: [...f.schedules, { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00' }] }))
    const removeScheduleRow = (idx: number) => setForm(f => ({ ...f, schedules: f.schedules.filter((_, i) => i !== idx) }))
    const updateSchedule = (idx: number, field: string, val: string) => {
        setForm(f => ({ ...f, schedules: f.schedules.map((s, i) => i === idx ? { ...s, [field]: val } : s) }))
    }

    const handleSave = async () => {
        if (!form.name) { toast.error('กรุณากรอกชื่อ'); return }
        try {
            const method = editId ? 'PATCH' : 'POST'
            const body = editId ? { id: editId, ...form } : form
            const res = await fetch('/api/teachers', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            if (res.ok) {
                toast.success(editId ? 'บันทึกสำเร็จ' : 'เพิ่มครูสำเร็จ')
                setShowModal(false)
                loadData()
            } else {
                const data = await res.json()
                toast.error(data.error)
            }
        } catch { toast.error('เกิดข้อผิดพลาด') }
    }

    if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--a-text-muted)' }}>กำลังโหลด...</div>

    return (
        <FadeIn><div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>ครูผู้สอน ({teachers.length})</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>จัดการข้อมูลครูผู้สอน ตารางสอน และสถานะการทำงาน</p>
                </div>
                <button onClick={openCreate} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={18} /> เพิ่มครู
                </button>
            </div>

            {/* Table */}
            <div className="admin-card">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>ชื่อ</th>
                            <th>เบอร์โทรศัพท์</th>
                            <th>Email</th>
                            <th>ประเภทกีฬา</th>
                            <th>วัน/เวลาที่สอน</th>
                            <th>คะแนน</th>
                            <th>สถานะ</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teachers.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: 'var(--a-text-muted)' }}>
                                <GraduationCap size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                                <p style={{ fontWeight: 600 }}>ยังไม่มีครูผู้สอน</p>
                            </td></tr>
                        ) : teachers.map(t => {
                            const st = STATUS_MAP[t.workStatus] || STATUS_MAP.ACTIVE
                            return (
                                <tr key={t.id}>
                                    <td style={{ fontWeight: 700 }}>{t.name}</td>
                                    <td style={{ fontSize: '13px' }}>{t.phone || '-'}</td>
                                    <td style={{ fontSize: '13px' }}>{t.email || '-'}</td>
                                    <td>{t.specialty || '-'}</td>
                                    <td style={{ fontSize: '12px', maxWidth: '180px' }}>
                                        {t.schedules.length === 0 ? <span style={{ color: 'var(--a-text-muted)' }}>ยังไม่ระบุ</span> :
                                            t.schedules.map((s, i) => (
                                                <div key={i}>{DAYS.find(d => d.key === s.dayOfWeek)?.label} {s.startTime}-{s.endTime}</div>
                                            ))
                                        }
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 700, color: t.avgScore >= 3 ? '#00b894' : t.avgScore >= 2 ? '#f5a623' : 'var(--a-text-muted)' }}>
                                            {t.avgScore > 0 ? t.avgScore.toFixed(1) : '-'}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}> ({t.evalCount})</span>
                                    </td>
                                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                                    <td>
                                        <button onClick={() => openEdit(t)} className="btn-admin-outline" style={{ padding: '4px 10px' }}>
                                            <Edit2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{editId ? 'แก้ไขครูผู้สอน' : 'เพิ่มครูผู้สอน'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <div style={{ display: 'grid', gap: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>ชื่อ-สกุล *</label>
                                    <input className="admin-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                                <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>เบอร์โทรศัพท์</label>
                                    <input className="admin-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>Email</label>
                                    <input className="admin-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                                <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>ประเภทกีฬา</label>
                                    <select className="admin-input" value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })}>
                                        <option value="">เลือก</option>
                                        {sportTypes.map(st => <option key={st} value={st}>{st}</option>)}
                                        <option value="ทั้งหมด">ทั้งหมด</option>
                                    </select></div>
                            </div>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>สถานะการทำงาน</label>
                                <select className="admin-input" value={form.workStatus} onChange={e => setForm({ ...form, workStatus: e.target.value })}>
                                    <option value="ACTIVE">ทำงาน</option><option value="ON_LEAVE">ลาหยุด</option><option value="SUSPENDED">ระงับ</option>
                                </select></div>

                            {/* Schedule */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label style={{ color: 'var(--a-text-secondary)', fontSize: '14px', fontWeight: 600 }}>
                                        <Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> ตารางสอน
                                    </label>
                                    <button onClick={addScheduleRow} className="btn-admin-outline" style={{ padding: '4px 10px', fontSize: '12px' }}>
                                        <Plus size={14} /> เพิ่มเวลา
                                    </button>
                                </div>
                                {form.schedules.length === 0 ? (
                                    <p style={{ fontSize: '13px', color: 'var(--a-text-muted)', textAlign: 'center', padding: '12px' }}>ยังไม่ได้กำหนดตารางสอน</p>
                                ) : form.schedules.map((s, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                        <select className="admin-input" style={{ flex: 1 }} value={s.dayOfWeek} onChange={e => updateSchedule(i, 'dayOfWeek', e.target.value)}>
                                            {DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                                        </select>
                                        <input className="admin-input" type="time" style={{ width: '110px' }} value={s.startTime} onChange={e => updateSchedule(i, 'startTime', e.target.value)} />
                                        <span style={{ color: 'var(--a-text-muted)' }}>-</span>
                                        <input className="admin-input" type="time" style={{ width: '110px' }} value={s.endTime} onChange={e => updateSchedule(i, 'endTime', e.target.value)} />
                                        <button onClick={() => removeScheduleRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e17055' }}><Trash2 size={16} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <button onClick={() => setShowModal(false)} className="btn-admin-outline">ยกเลิก</button>
                            <button onClick={handleSave} className="btn-admin"><Save size={16} /> บันทึก</button>
                        </div>
                    </div>
                </div>
            )}
        </div></FadeIn>
    )
}
