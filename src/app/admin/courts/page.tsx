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

interface Venue { id: string; name: string; image: string | null; description: string | null }
interface Court {
    id: string; name: string; description: string | null; sportType: string | null; isActive: boolean; status: string; sortOrder: number; venueId: string | null
    operatingHours: Array<{ id: string; dayOfWeek: string; openTime: string; closeTime: string; isClosed: boolean }>
    venue?: Venue | null
}

export default function CourtsManagement() {
    const [courts, setCourts] = useState<Court[]>([])
    const [venues, setVenues] = useState<Venue[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingCourt, setEditingCourt] = useState<Court | null>(null)
    const [form, setForm] = useState({ name: '', description: '', sportType: '', sortOrder: 0, status: 'ACTIVE', venueId: '' })
    const [hours, setHours] = useState(DAYS.map(d => ({ dayOfWeek: d.key, openTime: '08:00', closeTime: '23:00', isClosed: false })))
    const [selectedFilter, setSelectedFilter] = useState<string | null>(null) // null = all, venueId string

    useEffect(() => {
        fetchCourts()
        fetchVenues()
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

    const fetchVenues = async () => {
        try {
            const res = await fetch('/api/venues', { cache: 'no-store' })
            const data = await res.json()
            if (data.venues) setVenues(data.venues.filter((v: Venue & { isActive: boolean }) => v.isActive !== false))
        } catch { /* ignore */ }
    }

    const openModal = (court?: Court) => {
        if (court) {
            setEditingCourt(court)
            setForm({ name: court.name, description: court.description || '', sportType: court.sportType || '', sortOrder: court.sortOrder, status: court.status || 'ACTIVE', venueId: court.venueId || '' })
            setHours(DAYS.map(d => {
                const existing = court.operatingHours.find(h => h.dayOfWeek === d.key)
                return existing ? { dayOfWeek: d.key, openTime: existing.openTime, closeTime: existing.closeTime, isClosed: existing.isClosed }
                    : { dayOfWeek: d.key, openTime: '09:00', closeTime: '00:00', isClosed: false }
            }))
        } else {
            setEditingCourt(null)
            setForm({ name: '', description: '', sportType: '', sortOrder: 0, status: 'ACTIVE', venueId: selectedFilter || '' })
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

    const deleteCourt = async (court: Court) => {
        if (!confirm(`ต้องการลบ "${court.name}" ใช่ไหม?\nข้อมูลเวลาเปิด-ปิดจะถูกลบไปด้วย`)) return
        try {
            const res = await fetch('/api/courts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: court.id }),
            })
            if (res.ok) {
                toast.success('ลบสนามสำเร็จ')
                fetchCourts()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error || 'ลบไม่สำเร็จ')
            }
        } catch { toast.error('เกิดข้อผิดพลาด') }
    }

    const filteredCourts = selectedFilter
        ? courts.filter(c => c.venueId === selectedFilter)
        : courts

    const renderCourtCard = (court: Court) => {
        return (
            <div key={court.id} className="admin-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--a-primary-light)', color: 'var(--a-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, flexShrink: 0 }}>
                            {court.sortOrder + 1}
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--a-text)', marginBottom: '2px' }}>{court.name}</h3>
                            <p style={{ fontSize: '12px', color: 'var(--a-text-muted)', margin: 0 }}>{court.description || ''}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{
                            fontSize: '11px', padding: '2px 8px', borderRadius: '6px', fontWeight: 600,
                            background: court.status === 'ACTIVE' ? '#d4edda' : court.status === 'CLOSED' ? '#fef3cd' : '#fde8e8',
                            color: court.status === 'ACTIVE' ? '#27ae60' : court.status === 'CLOSED' ? '#e67e22' : '#e74c3c',
                        }}>
                            {court.status === 'ACTIVE' ? '🟢 เปิด' : court.status === 'CLOSED' ? '🟡 ปิด' : '🔴 ยกเลิก'}
                        </span>
                        <button onClick={() => openModal(court)} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text-secondary)' }}>
                            <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteCourt(court)} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c' }}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
                {/* Operating hours — compact */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {DAYS.map(d => {
                        const h = court.operatingHours.find(oh => oh.dayOfWeek === d.key)
                        const open = h && !h.isClosed
                        return (
                            <div key={d.key} style={{
                                padding: '3px 8px', borderRadius: '4px', fontSize: '11px',
                                background: open ? '#e8f5e9' : '#fde4de',
                                color: open ? '#2e7d32' : '#c62828',
                            }}>
                                <strong>{d.label}</strong> {open ? `${h.openTime}-${h.closeTime}` : 'ปิด'}
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

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

            {/* Venue Filter Tabs */}
            {venues.length > 0 && (
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
                        📍 ทั้งหมด ({courts.length})
                    </button>
                    {venues.map(v => {
                        const count = courts.filter(c => c.venueId === v.id).length
                        return (
                            <button key={v.id}
                                onClick={() => setSelectedFilter(selectedFilter === v.id ? null : v.id)}
                                style={{
                                    padding: '8px 20px', borderRadius: '999px', cursor: 'pointer', fontWeight: 700, fontSize: '14px',
                                    fontFamily: 'inherit', border: 'none', transition: 'all 0.2s',
                                    background: selectedFilter === v.id ? '#f59e0b' : '#f3f4f6',
                                    color: selectedFilter === v.id ? 'white' : '#374151',
                                    boxShadow: selectedFilter === v.id ? '0 2px 8px rgba(245,158,11,0.3)' : 'none',
                                }}>
                                📍 {v.name} ({count})
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
                        {selectedFilter ? `ไม่มีสนามในสถานที่ "${venues.find(v => v.id === selectedFilter)?.name || selectedFilter}"` : 'ยังไม่มีสนาม'}
                    </p>
                    <button onClick={() => openModal()} className="btn-admin">เพิ่มสนาม</button>
                </div>
            ) : (
                <div>
                    {/* Group by venue when showing all */}
                    {!selectedFilter ? (
                        <>
                            {venues.map(v => {
                                const group = courts.filter(c => c.venueId === v.id)
                                if (group.length === 0) return null
                                return (
                                    <div key={v.id} style={{ marginBottom: '28px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <span style={{ fontSize: '18px' }}>📍</span>
                                            <h3 style={{ fontWeight: 700, fontSize: '16px', color: 'var(--a-text)' }}>{v.name}</h3>
                                            <span style={{ fontSize: '13px', color: 'var(--a-text-muted)' }}>({group.length} สนาม)</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
                                            {group.map(court => renderCourtCard(court))}
                                        </div>
                                    </div>
                                )
                            })}
                            {/* Courts without venue */}
                            {(() => {
                                const noVenue = courts.filter(c => !c.venueId)
                                if (noVenue.length === 0) return null
                                return (
                                    <div style={{ marginBottom: '28px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <span style={{ fontSize: '18px' }}>📍</span>
                                            <h3 style={{ fontWeight: 700, fontSize: '16px', color: 'var(--a-text)' }}>อื่นๆ</h3>
                                            <span style={{ fontSize: '13px', color: 'var(--a-text-muted)' }}>({noVenue.length} สนาม)</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
                                            {noVenue.map(court => renderCourtCard(court))}
                                        </div>
                                    </div>
                                )
                            })()}
                        </>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
                            {filteredCourts.map(court => renderCourtCard(court))}
                        </div>
                    )}
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
                                <label style={{ color: 'var(--a-text-secondary)' }}>สถานที่เรียน</label>
                                {venues.length > 0 ? (
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {venues.map(v => (
                                            <button key={v.id}
                                                onClick={() => setForm({ ...form, venueId: form.venueId === v.id ? '' : v.id })}
                                                style={{
                                                    padding: '8px 16px', borderRadius: '999px', cursor: 'pointer',
                                                    fontWeight: 600, fontSize: '13px', fontFamily: 'inherit',
                                                    border: 'none', transition: 'all 0.2s',
                                                    background: form.venueId === v.id ? '#f59e0b' : '#f3f4f6',
                                                    color: form.venueId === v.id ? 'white' : '#374151',
                                                }}>
                                                📍 {v.name}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <input className="admin-input" value={form.sportType} onChange={e => setForm({ ...form, sportType: e.target.value })} placeholder="เช่น สโลปสกี A" />
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
