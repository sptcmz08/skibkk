'use client'

import { useState, useEffect } from 'react'
import { MapPin, Plus, Edit2, Trash2, Clock, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'

const DAYS = [
    { key: 'MONDAY', label: 'จันทร์' }, { key: 'TUESDAY', label: 'อังคาร' },
    { key: 'WEDNESDAY', label: 'พุธ' }, { key: 'THURSDAY', label: 'พฤหัสบดี' },
    { key: 'FRIDAY', label: 'ศุกร์' }, { key: 'SATURDAY', label: 'เสาร์' },
    { key: 'SUNDAY', label: 'อาทิตย์' },
]

interface SportType { id: string; name: string; icon: string; color: string }
interface Court {
    id: string; name: string; description: string | null; sportType: string | null; isActive: boolean; status: string; sortOrder: number
    operatingHours: Array<{ id: string; dayOfWeek: string; openTime: string; closeTime: string; isClosed: boolean }>
}

export default function CourtsManagement() {
    const [courts, setCourts] = useState<Court[]>([])
    const [sportTypes, setSportTypes] = useState<SportType[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingCourt, setEditingCourt] = useState<Court | null>(null)
    const [form, setForm] = useState({ name: '', description: '', sportType: '', sortOrder: 0, status: 'ACTIVE' })
    const [hours, setHours] = useState(DAYS.map(d => ({ dayOfWeek: d.key, openTime: '08:00', closeTime: '23:00', isClosed: false })))
    const [selectedFilter, setSelectedFilter] = useState<string | null>(null) // null = all

    useEffect(() => {
        fetchCourts()
        fetchSportTypes()
    }, [])

    const fetchCourts = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/courts?admin=1', { cache: 'no-store' })
            const data = await res.json()
            if (data.courts) setCourts(data.courts)
        } catch { toast.error('โหลดข้อมูลไม่สำเร็จ') }
        finally { setLoading(false) }
    }

    const fetchSportTypes = async () => {
        try {
            const res = await fetch('/api/sport-types', { cache: 'no-store' })
            const data = await res.json()
            if (data.sportTypes) setSportTypes(data.sportTypes.filter((s: SportType & { isActive: boolean }) => s.isActive !== false))
        } catch { /* ignore */ }
    }

    const openModal = (court?: Court) => {
        if (court) {
            setEditingCourt(court)
            setForm({ name: court.name, description: court.description || '', sportType: court.sportType || '', sortOrder: court.sortOrder, status: court.status || 'ACTIVE' })
            setHours(DAYS.map(d => {
                const existing = court.operatingHours.find(h => h.dayOfWeek === d.key)
                return existing ? { dayOfWeek: d.key, openTime: existing.openTime, closeTime: existing.closeTime, isClosed: existing.isClosed }
                    : { dayOfWeek: d.key, openTime: '09:00', closeTime: '00:00', isClosed: false }
            }))
        } else {
            setEditingCourt(null)
            setForm({ name: '', description: '', sportType: selectedFilter || '', sortOrder: 0, status: 'ACTIVE' })
            setHours(DAYS.map(d => ({ dayOfWeek: d.key, openTime: '09:00', closeTime: '00:00', isClosed: false })))
        }
        setShowModal(true)
    }

    const saveCourt = async () => {
        if (!form.name.trim()) { toast.error('กรุณาระบุชื่อสนาม'); return }
        try {
            const res = await fetch('/api/courts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...(editingCourt ? { id: editingCourt.id } : {}), ...form, operatingHours: hours }),
            })
            if (res.ok) {
                toast.success('บันทึกสำเร็จ')
                setShowModal(false)
                fetchCourts()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error || 'บันทึกไม่สำเร็จ')
            }
        } catch { toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ') }
    }

    const filteredCourts = selectedFilter
        ? courts.filter(c => c.sportType === selectedFilter)
        : courts

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>จัดการสนาม</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>จัดการสนามและเวลาเปิด-ปิดของแต่ละสนาม</p>
                </div>
                <button onClick={() => openModal()} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={18} /> เพิ่มสนาม
                </button>
            </div>

            {/* Sport Type Filter Tabs */}
            {sportTypes.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setSelectedFilter(null)}
                        style={{
                            padding: '8px 20px', borderRadius: '999px', cursor: 'pointer', fontWeight: 700, fontSize: '14px',
                            fontFamily: 'inherit', border: 'none', transition: 'all 0.2s',
                            background: selectedFilter === null ? '#f59e0b' : '#f3f4f6',
                            color: selectedFilter === null ? 'white' : '#374151',
                            boxShadow: selectedFilter === null ? '0 2px 8px rgba(245,158,11,0.3)' : 'none',
                        }}>
                        🏟️ ทั้งหมด ({courts.length})
                    </button>
                    {sportTypes.map(st => {
                        const count = courts.filter(c => c.sportType === st.name).length
                        return (
                            <button key={st.id}
                                onClick={() => setSelectedFilter(selectedFilter === st.name ? null : st.name)}
                                style={{
                                    padding: '8px 20px', borderRadius: '999px', cursor: 'pointer', fontWeight: 700, fontSize: '14px',
                                    fontFamily: 'inherit', border: 'none', transition: 'all 0.2s',
                                    background: selectedFilter === st.name ? st.color : '#f3f4f6',
                                    color: selectedFilter === st.name ? 'white' : '#374151',
                                    boxShadow: selectedFilter === st.name ? `0 2px 8px ${st.color}44` : 'none',
                                }}>
                                {st.icon} {st.name} ({count})
                            </button>
                        )
                    })}
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--a-text-muted)' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)', margin: '0 auto' }} /></div>
            ) : filteredCourts.length === 0 ? (
                <div className="admin-card" style={{ padding: '60px', textAlign: 'center' }}>
                    <MapPin size={48} style={{ color: 'var(--a-text-muted)', marginBottom: '16px' }} />
                    <p style={{ fontWeight: 600, color: 'var(--a-text-secondary)', marginBottom: '8px' }}>
                        {selectedFilter ? `ไม่มีสนามในประเภท "${selectedFilter}"` : 'ยังไม่มีสนาม'}
                    </p>
                    <button onClick={() => openModal()} className="btn-admin">เพิ่มสนาม</button>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {filteredCourts.map(court => {
                        const stObj = sportTypes.find(s => s.name === court.sportType)
                        return (
                            <div key={court.id} className="admin-card">
                                <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--a-primary-light)', color: 'var(--a-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800 }}>
                                            {court.sortOrder + 1}
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <h3 style={{ fontWeight: 700, fontSize: '16px', color: 'var(--a-text)' }}>{court.name}</h3>
                                                {stObj && (
                                                    <span style={{
                                                        padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                                                        background: stObj.color + '20', color: stObj.color,
                                                    }}>
                                                        {stObj.icon} {stObj.name}
                                                    </span>
                                                )}
                                            </div>
                                            <p style={{ fontSize: '13px', color: 'var(--a-text-muted)' }}>{court.description || 'ไม่มีคำอธิบาย'}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <span className={`badge ${court.status === 'ACTIVE' ? 'badge-success' : court.status === 'CLOSED' ? 'badge-warning' : 'badge-danger'}`}>
                                            {court.status === 'ACTIVE' ? '🟢 เปิด' : court.status === 'CLOSED' ? '🟡 ปิด' : '🔴 ยกเลิก'}
                                        </span>
                                        <button onClick={() => openModal(court)} className="btn-admin-outline" style={{ padding: '6px 12px' }}>
                                            <Edit2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                {/* Operating hours */}
                                <div style={{ padding: '12px 24px 16px', borderTop: '1px solid var(--a-border)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {DAYS.map(d => {
                                        const h = court.operatingHours.find(oh => oh.dayOfWeek === d.key)
                                        return (
                                            <div key={d.key} style={{
                                                padding: '6px 12px', borderRadius: '6px', fontSize: '12px',
                                                background: h && !h.isClosed ? '#e8f5e9' : '#fde4de',
                                                color: h && !h.isClosed ? '#2e7d32' : '#c62828',
                                            }}>
                                                <strong>{d.label}</strong> {h && !h.isClosed ? `${h.openTime}-${h.closeTime}` : 'ปิด'}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>
                                {editingCourt ? 'แก้ไขสนาม' : 'เพิ่มสนามใหม่'}
                            </h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text-muted)' }}><X size={24} /></button>
                        </div>

                        <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
                            <div className="input-group">
                                <label style={{ color: 'var(--a-text-secondary)' }}>ชื่อสนาม</label>
                                <input className="admin-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="เช่น สนาม A" />
                            </div>
                            <div className="input-group">
                                <label style={{ color: 'var(--a-text-secondary)' }}>ประเภทกีฬา</label>
                                {sportTypes.length > 0 ? (
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {sportTypes.map(st => (
                                            <button key={st.id}
                                                onClick={() => setForm({ ...form, sportType: form.sportType === st.name ? '' : st.name })}
                                                style={{
                                                    padding: '8px 16px', borderRadius: '999px', cursor: 'pointer',
                                                    fontWeight: 600, fontSize: '13px', fontFamily: 'inherit',
                                                    border: 'none', transition: 'all 0.2s',
                                                    background: form.sportType === st.name ? st.color : '#f3f4f6',
                                                    color: form.sportType === st.name ? 'white' : '#374151',
                                                }}>
                                                {st.icon} {st.name}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <input className="admin-input" value={form.sportType} onChange={e => setForm({ ...form, sportType: e.target.value })} placeholder="เช่น สกี้, สโนบอร์ด" />
                                )}
                            </div>
                            <div className="input-group">
                                <label style={{ color: 'var(--a-text-secondary)' }}>คำอธิบาย</label>
                                <input className="admin-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="รายละเอียดสนาม" />
                            </div>
                            <div className="input-group">
                                <label style={{ color: 'var(--a-text-secondary)' }}>สถานะสนาม</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {([
                                        { value: 'ACTIVE', label: '🟢 เปิด', desc: 'ลูกค้าเห็นและจองได้', color: '#00b894' },
                                        { value: 'CLOSED', label: '🟡 ปิด', desc: 'ลูกค้าเห็นแต่จองไม่ได้', color: '#fdcb6e' },
                                        { value: 'HIDDEN', label: '🔴 ยกเลิก', desc: 'ลูกค้าไม่เห็น', color: '#e17055' },
                                    ] as const).map(s => (
                                        <button key={s.value}
                                            onClick={() => setForm({ ...form, status: s.value })}
                                            style={{
                                                padding: '10px 16px', borderRadius: '10px', cursor: 'pointer',
                                                fontWeight: 600, fontSize: '13px', fontFamily: 'inherit',
                                                border: form.status === s.value ? `2px solid ${s.color}` : '2px solid #e9ecef',
                                                background: form.status === s.value ? s.color + '15' : '#f9f9f9',
                                                color: form.status === s.value ? s.color : '#6b7280',
                                                transition: 'all 0.2s', flex: 1, textAlign: 'center',
                                            }}>
                                            <div>{s.label}</div>
                                            <div style={{ fontSize: '11px', fontWeight: 400, marginTop: '2px', opacity: 0.8 }}>{s.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <h3 style={{ fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--a-text)' }}>
                            <Clock size={18} /> เวลาเปิด-ปิด
                        </h3>
                        <div style={{ display: 'grid', gap: '8px', marginBottom: '24px' }}>
                            {hours.map((h, i) => (
                                <div key={h.dayOfWeek} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: '#f8f9fa' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '100px' }}>
                                        <input type="checkbox" checked={!h.isClosed} onChange={e => {
                                            const updated = [...hours]; updated[i].isClosed = !e.target.checked; setHours(updated)
                                        }} style={{ accentColor: 'var(--a-primary)' }} />
                                        <span style={{ fontWeight: 600, fontSize: '14px', color: h.isClosed ? 'var(--a-text-muted)' : 'var(--a-text)' }}>
                                            {DAYS[i].label}
                                        </span>
                                    </label>
                                    {!h.isClosed && (
                                        <>
                                            <input type="time" className="admin-input" style={{ width: '120px' }} value={h.openTime} onChange={e => { const u = [...hours]; u[i].openTime = e.target.value; setHours(u) }} />
                                            <span style={{ color: 'var(--a-text-muted)' }}>ถึง</span>
                                            <input type="time" className="admin-input" style={{ width: '120px' }} value={h.closeTime} onChange={e => { const u = [...hours]; u[i].closeTime = e.target.value; setHours(u) }} />
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowModal(false)} className="btn-admin-outline">ยกเลิก</button>
                            <button onClick={saveCourt} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Save size={16} /> บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
