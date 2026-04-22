'use client'

import { FadeIn } from '@/components/Motion'
import ConfirmModal from '@/components/ConfirmModal'
import { useEffect, useState } from 'react'
import { GraduationCap, Plus, Clock, X, Save, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const DAYS = [
    { key: 'MONDAY', label: 'จันทร์' },
    { key: 'TUESDAY', label: 'อังคาร' },
    { key: 'WEDNESDAY', label: 'พุธ' },
    { key: 'THURSDAY', label: 'พฤหัสบดี' },
    { key: 'FRIDAY', label: 'ศุกร์' },
    { key: 'SATURDAY', label: 'เสาร์' },
    { key: 'SUNDAY', label: 'อาทิตย์' },
]

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: 'ทำงาน', cls: 'badge-success' },
    ON_LEAVE: { label: 'ลาหยุด', cls: 'badge-warning' },
    SUSPENDED: { label: 'ระงับ', cls: 'badge-danger' },
}

interface Schedule {
    id?: string
    dayOfWeek: string
    startTime: string
    endTime: string
}

interface Teacher {
    id: string
    name: string
    phone: string | null
    email: string | null
    specialty: string | null
    workStatus: string
    isActive: boolean
    schedules: Schedule[]
    avgScore: number
    evalCount: number
    _count: { evaluations: number; participants: number }
}

const emptyForm = {
    name: '',
    phone: '',
    email: '',
    specialty: '',
    workStatus: 'ACTIVE',
    schedules: [] as Schedule[],
}

export default function TeachersPage() {
    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [sportTypes, setSportTypes] = useState<string[]>([])
    const [pendingDeleteTeacher, setPendingDeleteTeacher] = useState<Teacher | null>(null)

    const loadData = () => {
        fetch('/api/teachers')
            .then(r => r.json())
            .then(data => setTeachers(data.teachers || []))
            .catch(() => toast.error('โหลดข้อมูลครูผู้สอนไม่สำเร็จ'))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        loadData()
        fetch('/api/sport-types', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                if (data.sportTypes) setSportTypes(data.sportTypes.map((st: { name?: string } | string) => typeof st === 'string' ? st : (st.name || '')))
            })
            .catch(() => { })
    }, [])

    const openCreate = () => {
        setEditId(null)
        setForm(emptyForm)
        setShowModal(true)
    }

    const openEdit = (teacher: Teacher) => {
        setEditId(teacher.id)
        setForm({
            name: teacher.name,
            phone: teacher.phone || '',
            email: teacher.email || '',
            specialty: teacher.specialty || '',
            workStatus: teacher.workStatus,
            schedules: teacher.schedules.map(schedule => ({
                dayOfWeek: schedule.dayOfWeek,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
            })),
        })
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditId(null)
        setForm(emptyForm)
    }

    const addScheduleRow = () => {
        setForm(prev => ({
            ...prev,
            schedules: [...prev.schedules, { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00' }],
        }))
    }

    const removeScheduleRow = (index: number) => {
        setForm(prev => ({
            ...prev,
            schedules: prev.schedules.filter((_, idx) => idx !== index),
        }))
    }

    const updateSchedule = (index: number, field: keyof Schedule, value: string) => {
        setForm(prev => ({
            ...prev,
            schedules: prev.schedules.map((schedule, idx) => idx === index ? { ...schedule, [field]: value } : schedule),
        }))
    }

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error('กรุณากรอกชื่อครูผู้สอน')
            return
        }

        try {
            const method = editId ? 'PATCH' : 'POST'
            const body = editId ? { id: editId, ...form } : form
            const res = await fetch('/api/teachers', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            if (res.ok) {
                toast.success(editId ? 'บันทึกข้อมูลครูผู้สอนแล้ว' : 'เพิ่มครูผู้สอนแล้ว')
                closeModal()
                loadData()
                return
            }

            const data = await res.json().catch(() => ({}))
            toast.error(data.error || 'บันทึกข้อมูลไม่สำเร็จ')
        } catch {
            toast.error('เกิดข้อผิดพลาด')
        }
    }

    const handleDeleteTeacher = async () => {
        if (!pendingDeleteTeacher) return

        try {
            const res = await fetch(`/api/teachers?id=${pendingDeleteTeacher.id}`, { method: 'DELETE' })
            const data = await res.json().catch(() => ({}))

            if (!res.ok) {
                toast.error(data.error || 'ลบครูผู้สอนไม่สำเร็จ')
                return
            }

            toast.success(`ลบครูผู้สอน ${pendingDeleteTeacher.name} แล้ว`)
            if (editId === pendingDeleteTeacher.id) {
                closeModal()
            }
            setPendingDeleteTeacher(null)
            loadData()
        } catch {
            toast.error('เกิดข้อผิดพลาด')
        }
    }

    if (loading) {
        return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--a-text-muted)' }}>กำลังโหลด...</div>
    }

    return (
        <FadeIn>
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>ครูผู้สอน ({teachers.length})</h2>
                        <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>จัดการข้อมูลครูผู้สอน ตารางสอน และสถานะการทำงาน</p>
                    </div>
                    <button onClick={openCreate} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={18} /> เพิ่มครู
                    </button>
                </div>

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
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: 'var(--a-text-muted)' }}>
                                        <GraduationCap size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                                        <p style={{ fontWeight: 600 }}>ยังไม่มีครูผู้สอน</p>
                                    </td>
                                </tr>
                            ) : teachers.map(teacher => {
                                const status = STATUS_MAP[teacher.workStatus] || STATUS_MAP.ACTIVE
                                return (
                                    <tr key={teacher.id}>
                                        <td style={{ fontWeight: 700 }}>{teacher.name}</td>
                                        <td style={{ fontSize: '13px' }}>{teacher.phone || '-'}</td>
                                        <td style={{ fontSize: '13px' }}>{teacher.email || '-'}</td>
                                        <td>{teacher.specialty || '-'}</td>
                                        <td style={{ fontSize: '12px', maxWidth: '180px' }}>
                                            {teacher.schedules.length === 0 ? (
                                                <span style={{ color: 'var(--a-text-muted)' }}>ยังไม่ระบุ</span>
                                            ) : teacher.schedules.map((schedule, index) => (
                                                <div key={index}>
                                                    {DAYS.find(day => day.key === schedule.dayOfWeek)?.label} {schedule.startTime}-{schedule.endTime}
                                                </div>
                                            ))}
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 700, color: teacher.avgScore >= 3 ? '#00b894' : teacher.avgScore >= 2 ? '#f5a623' : 'var(--a-text-muted)' }}>
                                                {teacher.avgScore > 0 ? teacher.avgScore.toFixed(1) : '-'}
                                            </span>
                                            <span style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}> ({teacher.evalCount})</span>
                                        </td>
                                        <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <button onClick={() => openEdit(teacher)} className="btn-admin-outline" style={{ padding: '4px 10px' }} title="แก้ไขครูผู้สอน">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setPendingDeleteTeacher(teacher)}
                                                    className="btn-admin-outline"
                                                    style={{ padding: '4px 10px', color: '#e74c3c', borderColor: 'rgba(231,76,60,0.35)' }}
                                                    title="ลบครูผู้สอน"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {showModal && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{editId ? 'แก้ไขครูผู้สอน' : 'เพิ่มครูผู้สอน'}</h2>
                                <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <X size={24} />
                                </button>
                            </div>
                            <div style={{ display: 'grid', gap: '14px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                    <div className="input-group">
                                        <label style={{ color: 'var(--a-text-secondary)' }}>ชื่อ-สกุล *</label>
                                        <input className="admin-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <label style={{ color: 'var(--a-text-secondary)' }}>เบอร์โทรศัพท์</label>
                                        <input className="admin-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                    <div className="input-group">
                                        <label style={{ color: 'var(--a-text-secondary)' }}>Email</label>
                                        <input className="admin-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <label style={{ color: 'var(--a-text-secondary)' }}>ประเภทกีฬา</label>
                                        <select className="admin-input" value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })}>
                                            <option value="">เลือก</option>
                                            {sportTypes.map(type => <option key={type} value={type}>{type}</option>)}
                                            <option value="ทั้งหมด">ทั้งหมด</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label style={{ color: 'var(--a-text-secondary)' }}>สถานะการทำงาน</label>
                                    <select className="admin-input" value={form.workStatus} onChange={e => setForm({ ...form, workStatus: e.target.value })}>
                                        <option value="ACTIVE">ทำงาน</option>
                                        <option value="ON_LEAVE">ลาหยุด</option>
                                        <option value="SUSPENDED">ระงับ</option>
                                    </select>
                                </div>

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
                                    ) : form.schedules.map((schedule, index) => (
                                        <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                            <select className="admin-input" style={{ flex: 1 }} value={schedule.dayOfWeek} onChange={e => updateSchedule(index, 'dayOfWeek', e.target.value)}>
                                                {DAYS.map(day => <option key={day.key} value={day.key}>{day.label}</option>)}
                                            </select>
                                            <input className="admin-input" type="time" style={{ width: '110px' }} value={schedule.startTime} onChange={e => updateSchedule(index, 'startTime', e.target.value)} />
                                            <span style={{ color: 'var(--a-text-muted)' }}>-</span>
                                            <input className="admin-input" type="time" style={{ width: '110px' }} value={schedule.endTime} onChange={e => updateSchedule(index, 'endTime', e.target.value)} />
                                            <button onClick={() => removeScheduleRow(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e17055' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', marginTop: '24px', flexWrap: 'wrap' }}>
                                <div>
                                    {editId && (
                                        <button
                                            onClick={() => {
                                                const currentTeacher = teachers.find(teacher => teacher.id === editId) || null
                                                if (currentTeacher) setPendingDeleteTeacher(currentTeacher)
                                            }}
                                            className="btn-admin-outline"
                                            style={{ color: '#e74c3c', borderColor: 'rgba(231,76,60,0.35)' }}
                                        >
                                            <Trash2 size={16} /> ลบชื่อครู
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                    <button onClick={closeModal} className="btn-admin-outline">ยกเลิก</button>
                                    <button onClick={handleSave} className="btn-admin"><Save size={16} /> บันทึก</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <ConfirmModal
                    open={!!pendingDeleteTeacher}
                    title="ลบครูผู้สอน"
                    message={`ต้องการลบ "${pendingDeleteTeacher?.name || ''}" ออกจากระบบใช่ไหม?\nหากครูคนนี้ยังถูกใช้งานในประวัติการสอน ระบบจะไม่อนุญาตให้ลบ`}
                    confirmText="ลบครู"
                    cancelText="ยกเลิก"
                    type="danger"
                    onConfirm={handleDeleteTeacher}
                    onCancel={() => setPendingDeleteTeacher(null)}
                />
            </div>
        </FadeIn>
    )
}
