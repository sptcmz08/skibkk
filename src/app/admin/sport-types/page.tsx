'use client'

import { FadeIn } from '@/components/Motion'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'

interface SportType {
    id: string; name: string; icon: string; color: string; sortOrder: number; isActive: boolean
}

const EMOJI_OPTIONS = [
    '⛷️', '🏂', '⛸️', '🎿', '🛷',
    '⚽', '🏀', '🏈', '⚾', '🥎', '🏐', '🏉', '🎾', '🏸', '🏓', '🏒', '🥍', '🥏',
    '⛳', '🏌️', '🥊', '🥋', '🤼', '🤺', '🎯', '🪃',
    '🏊', '🤽', '🚣', '🏄', '🤿', '🛶',
    '🚴', '🚵', '🏇', '🛹', '🛼', '🪂',
    '🏋️', '🤸', '🧗', '🤾', '🏃', '🚶', '🧘', '🤹',
    '🎳', '🏟️', '🥅', '🏆', '🥇', '🎖️',
    '🏏', '🥌', '🏑', '🪀', '🎱', '♟️',
    '🏹', '⚡', '🔥', '💪', '👟', '🎽',
]
const COLOR_OPTIONS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1']

export default function SportTypesPage() {
    const [sportTypes, setSportTypes] = useState<SportType[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<SportType | null>(null)
    const [form, setForm] = useState({ name: '', icon: '🏟️', color: '#f59e0b' })

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/sport-types', { cache: 'no-store' })
            const data = await res.json()
            if (data.sportTypes) setSportTypes(data.sportTypes)
        } catch { toast.error('โหลดข้อมูลไม่สำเร็จ') }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchData() }, [])

    const openModal = (st?: SportType) => {
        if (st) {
            setEditing(st)
            setForm({ name: st.name, icon: st.icon, color: st.color })
        } else {
            setEditing(null)
            setForm({ name: '', icon: '🏟️', color: '#f59e0b' })
        }
        setShowModal(true)
    }

    const handleSave = async () => {
        if (!form.name.trim()) { toast.error('กรุณาระบุชื่อประเภทกีฬา'); return }
        try {
            const res = await fetch('/api/sport-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(editing ? { id: editing.id } : {}),
                    name: form.name, icon: form.icon, color: form.color,
                    sortOrder: editing?.sortOrder ?? sportTypes.length,
                }),
            })
            const data = await res.json()
            if (!res.ok) { toast.error(data.error || 'บันทึกไม่สำเร็จ'); return }
            toast.success('บันทึกสำเร็จ')
            setShowModal(false)
            fetchData()
        } catch { toast.error('เกิดข้อผิดพลาด') }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`ลบประเภท "${name}" ใช่ไหม?`)) return
        try {
            const res = await fetch(`/api/sport-types?id=${id}`, { method: 'DELETE' })
            if (res.ok) { toast.success('ลบสำเร็จ'); fetchData() }
            else toast.error('ลบไม่สำเร็จ')
        } catch { toast.error('เกิดข้อผิดพลาด') }
    }

    const toggleActive = async (st: SportType) => {
        try {
            await fetch('/api/sport-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: st.id, name: st.name, icon: st.icon, color: st.color, sortOrder: st.sortOrder, isActive: !st.isActive }),
            })
            fetchData()
        } catch { toast.error('เกิดข้อผิดพลาด') }
    }

    return (
        <FadeIn><div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>ประเภทกีฬา ({sportTypes.length})</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>จัดการประเภทกีฬาที่แสดงในหน้าจองสนาม</p>
                </div>
                <button onClick={() => openModal()} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={18} /> เพิ่มประเภทกีฬา
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)', margin: '0 auto' }} /></div>
            ) : sportTypes.length === 0 ? (
                <div className="admin-card" style={{ padding: '60px', textAlign: 'center' }}>
                    <p style={{ fontSize: '48px', marginBottom: '12px' }}>🏟️</p>
                    <p style={{ fontWeight: 600, color: 'var(--a-text-secondary)', marginBottom: '8px' }}>ยังไม่มีประเภทกีฬา</p>
                    <p style={{ fontSize: '13px', color: 'var(--a-text-muted)', marginBottom: '16px' }}>เพิ่มประเภทกีฬาเพื่อจัดกลุ่มสนาม</p>
                    <button onClick={() => openModal()} className="btn-admin">เพิ่มประเภทแรก</button>
                </div>
            ) : (
                <div className="admin-card">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th style={{ width: '50px' }}>#</th>
                                <th>ไอคอน</th>
                                <th>ชื่อประเภท</th>
                                <th>สี</th>
                                <th>สถานะ</th>
                                <th style={{ width: '120px' }}>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sportTypes.map((st, idx) => (
                                <tr key={st.id}>
                                    <td style={{ color: 'var(--a-text-muted)' }}>
                                        <GripVertical size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', opacity: 0.4 }} />
                                        {idx + 1}
                                    </td>
                                    <td style={{ fontSize: '28px' }}>{st.icon}</td>
                                    <td style={{ fontWeight: 700 }}>{st.name}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: st.color, border: '1px solid rgba(0,0,0,0.1)' }} />
                                            <span style={{ fontSize: '12px', fontFamily: "'Inter'", color: 'var(--a-text-muted)' }}>{st.color}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <button onClick={() => toggleActive(st)}
                                            className={`badge ${st.isActive ? 'badge-success' : 'badge-danger'}`}
                                            style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
                                            {st.isActive ? 'เปิดใช้งาน' : 'ปิด'}
                                        </button>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={() => openModal(st)} className="btn-admin-outline" style={{ padding: '6px 10px' }}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button onClick={() => handleDelete(st.id, st.name)}
                                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fff5f5', color: '#ef4444', cursor: 'pointer' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>
                                {editing ? 'แก้ไขประเภทกีฬา' : 'เพิ่มประเภทกีฬาใหม่'}
                            </h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text-muted)' }}><X size={24} /></button>
                        </div>

                        <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
                            <div className="input-group">
                                <label style={{ color: 'var(--a-text-secondary)' }}>ชื่อประเภทกีฬา</label>
                                <input className="admin-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="เช่น สกี้, สโนบอร์ด" />
                            </div>

                            <div className="input-group">
                                <label style={{ color: 'var(--a-text-secondary)' }}>ไอคอน</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {EMOJI_OPTIONS.map(em => (
                                        <button key={em} onClick={() => setForm({ ...form, icon: em })}
                                            style={{
                                                fontSize: '24px', padding: '8px', borderRadius: '10px', cursor: 'pointer',
                                                border: form.icon === em ? '2px solid var(--a-primary)' : '2px solid transparent',
                                                background: form.icon === em ? 'var(--a-primary-light)' : '#f3f4f6',
                                            }}>{em}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="input-group">
                                <label style={{ color: 'var(--a-text-secondary)' }}>สีปุ่ม</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {COLOR_OPTIONS.map(c => (
                                        <button key={c} onClick={() => setForm({ ...form, color: c })}
                                            style={{
                                                width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer',
                                                background: c, border: form.color === c ? '3px solid #111' : '2px solid transparent',
                                                boxShadow: form.color === c ? '0 0 0 2px white, 0 0 0 4px #111' : 'none',
                                            }} />
                                    ))}
                                    <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                                        style={{ width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', border: 'none', padding: 0 }} />
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="input-group">
                                <label style={{ color: 'var(--a-text-secondary)' }}>ตัวอย่าง</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                                        padding: '8px 20px', borderRadius: '999px', fontWeight: 700, fontSize: '14px',
                                        background: form.color, color: 'white',
                                    }}>
                                        {form.icon} {form.name || 'ชื่อประเภท'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowModal(false)} className="btn-admin-outline">ยกเลิก</button>
                            <button onClick={handleSave} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Save size={16} /> บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div></FadeIn>
    )
}
