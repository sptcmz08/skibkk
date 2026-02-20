'use client'

import { useState } from 'react'
import { GraduationCap, Plus, Star, Phone, Clock, Edit2, X, Save } from 'lucide-react'
import toast from 'react-hot-toast'

interface Teacher {
    id: string; name: string; nickname: string; phone: string; specialization: string
    isActive: boolean; evalScore: number
}

export default function TeachersPage() {
    const [teachers, setTeachers] = useState<Teacher[]>([
        { id: '1', name: 'สมชาย รักสกี', nickname: 'โค้ชเอ', phone: '081-234-5678', specialization: 'สกี', isActive: true, evalScore: 4.8 },
        { id: '2', name: 'วิภาดา ลานหิมะ', nickname: 'โค้ชบี', phone: '082-345-6789', specialization: 'สโนว์บอร์ด', isActive: true, evalScore: 4.5 },
    ])
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ name: '', nickname: '', phone: '', specialization: '' })

    const addTeacher = () => {
        if (!form.name) { toast.error('กรุณากรอกชื่อ'); return }
        setTeachers([...teachers, { id: Date.now().toString(), ...form, isActive: true, evalScore: 0 }])
        setShowModal(false)
        toast.success('เพิ่มครูสำเร็จ')
        setForm({ name: '', nickname: '', phone: '', specialization: '' })
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>ครูผู้สอน ({teachers.length})</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>จัดการข้อมูลครูผู้สอนและตารางสอน</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={18} /> เพิ่มครู
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {teachers.map(t => (
                    <div key={t.id} className="admin-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'var(--a-primary-light)', color: 'var(--a-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800 }}>
                                {t.name.charAt(0)}
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontWeight: 700, fontSize: '16px', color: 'var(--a-text)' }}>{t.name}</h3>
                                <p style={{ fontSize: '13px', color: 'var(--a-text-muted)' }}>"{t.nickname}"</p>
                            </div>
                            <span className={`badge ${t.isActive ? 'badge-success' : 'badge-danger'}`}>{t.isActive ? 'ว่าง' : 'ไม่ว่าง'}</span>
                        </div>
                        <div style={{ display: 'grid', gap: '8px', fontSize: '14px', color: 'var(--a-text-secondary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><GraduationCap size={16} /> {t.specialization}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={16} /> {t.phone}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Star size={16} style={{ color: 'var(--a-primary)' }} />
                                <span style={{ fontWeight: 700, color: 'var(--a-primary)' }}>{t.evalScore > 0 ? t.evalScore : '-'}</span> / 5.0
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>เพิ่มครูผู้สอน</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <div style={{ display: 'grid', gap: '16px' }}>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>ชื่อ-สกุล</label><input className="admin-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>ชื่อเล่น</label><input className="admin-input" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} /></div>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>เบอร์โทร</label><input className="admin-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>ความเชี่ยวชาญ</label>
                                <select className="admin-input" value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })}>
                                    <option value="">เลือก</option><option value="สกี">สกี</option><option value="สโนว์บอร์ด">สโนว์บอร์ด</option><option value="ทั้งสองอย่าง">ทั้งสองอย่าง</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <button onClick={() => setShowModal(false)} className="btn-admin-outline">ยกเลิก</button>
                            <button onClick={addTeacher} className="btn-admin"><Save size={16} /> บันทึก</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
