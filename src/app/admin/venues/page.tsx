'use client'

import { FadeIn } from '@/components/Motion'

import { useState, useEffect } from 'react'
import { MapPin, Plus, Edit2, Trash2, Save, X, Image, ArrowUp, ArrowDown } from 'lucide-react'
import toast from 'react-hot-toast'

interface Venue {
    id: string; name: string; image: string | null; description: string | null; isActive: boolean; sortOrder: number
}

export default function VenuesManagement() {
    const [venues, setVenues] = useState<Venue[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Venue | null>(null)
    const [form, setForm] = useState({ name: '', image: '', description: '', isActive: true })

    useEffect(() => { fetchVenues() }, [])

    const fetchVenues = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/venues', { cache: 'no-store' })
            const data = await res.json()
            if (data.venues) setVenues(data.venues)
        } catch { toast.error('โหลดข้อมูลไม่สำเร็จ') }
        finally { setLoading(false) }
    }

    const openModal = (venue?: Venue) => {
        if (venue) {
            setEditing(venue)
            setForm({ name: venue.name, image: venue.image || '', description: venue.description || '', isActive: venue.isActive })
        } else {
            setEditing(null)
            setForm({ name: '', image: '', description: '', isActive: true })
        }
        setShowModal(true)
    }

    const saveVenue = async () => {
        if (!form.name.trim()) { toast.error('กรุณาระบุชื่อสถานที่'); return }
        try {
            const res = await fetch('/api/venues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...(editing ? { id: editing.id } : {}), ...form }),
            })
            if (res.ok) {
                toast.success('บันทึกสำเร็จ')
                setShowModal(false)
                fetchVenues()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error || 'บันทึกไม่สำเร็จ')
            }
        } catch { toast.error('เกิดข้อผิดพลาด') }
    }

    const deleteVenue = async (id: string) => {
        if (!confirm('ยืนยันลบสถานที่นี้?')) return
        try {
            const res = await fetch(`/api/venues?id=${id}`, { method: 'DELETE' })
            if (res.ok) { toast.success('ลบสำเร็จ'); fetchVenues() }
            else toast.error('ลบไม่สำเร็จ')
        } catch { toast.error('เกิดข้อผิดพลาด') }
    }

    const handleImageUpload = async (file: File) => {
        const formData = new FormData()
        formData.append('file', file)
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData })
            const data = await res.json()
            if (data.url) {
                setForm(f => ({ ...f, image: data.url }))
                toast.success('อัปโหลดรูปสำเร็จ')
            } else {
                toast.error('อัปโหลดไม่สำเร็จ')
            }
        } catch { toast.error('อัปโหลดไม่สำเร็จ') }
    }

    return (
        <FadeIn><div>
            <div className="admin-card-header" style={{ marginBottom: '20px' }}>
                <div>
                    <h1 className="admin-page-title">สถานที่เรียน</h1>
                    <p style={{ fontSize: '13px', color: 'var(--a-text-muted)', marginTop: '4px' }}>จัดการสถานที่เรียนสำหรับหน้าจองของลูกค้า</p>
                </div>
                <button onClick={() => openModal()} className="btn-admin"><Plus size={16} /> เพิ่มสถานที่</button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" /></div>
            ) : venues.length === 0 ? (
                <div className="admin-card" style={{ padding: '60px', textAlign: 'center' }}>
                    <MapPin size={40} style={{ color: 'var(--a-text-muted)', marginBottom: '12px' }} />
                    <p style={{ fontWeight: 600, color: 'var(--a-text-secondary)' }}>ยังไม่มีสถานที่เรียน</p>
                    <p style={{ fontSize: '13px', color: 'var(--a-text-muted)' }}>กดปุ่ม "เพิ่มสถานที่" เพื่อเริ่มต้น</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {venues.map(v => (
                        <div key={v.id} className="admin-card" style={{ padding: '0', overflow: 'hidden', opacity: v.isActive ? 1 : 0.5 }}>
                            <div style={{
                                height: '160px', background: v.image ? `url(${v.image}) center/cover` : 'linear-gradient(135deg, #f5a623 0%, #e8912d 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                            }}>
                                {!v.image && <MapPin size={40} style={{ color: 'rgba(255,255,255,0.5)' }} />}
                                {!v.isActive && (
                                    <div style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.6)', color: '#ff6b6b', fontSize: '11px', fontWeight: 600 }}>
                                        ปิดใช้งาน
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: '16px' }}>
                                <h3 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{v.name}</h3>
                                {v.description && <p style={{ fontSize: '13px', color: 'var(--a-text-muted)', marginBottom: '12px' }}>{v.description}</p>}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => openModal(v)} style={{ flex: 1, padding: '6px', background: 'var(--a-primary-light)', color: 'var(--a-primary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                                        <Edit2 size={13} /> แก้ไข
                                    </button>
                                    <button onClick={() => deleteVenue(v.id)} style={{ padding: '6px 10px', background: '#fde8e8', color: '#e74c3c', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                    onClick={() => setShowModal(false)}>
                    <div className="admin-card" style={{ width: '100%', maxWidth: '500px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{editing ? 'แก้ไขสถานที่' : 'เพิ่มสถานที่ใหม่'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text-muted)' }}><X size={20} /></button>
                        </div>

                        <div style={{ display: 'grid', gap: '16px' }}>
                            <div className="input-group">
                                <label style={{ fontWeight: 600, fontSize: '13px', color: 'var(--a-text-secondary)', marginBottom: '6px', display: 'block' }}>ชื่อสถานที่ *</label>
                                <input className="admin-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="เช่น สโลป A, ห้องเรียน 1" />
                            </div>

                            <div className="input-group">
                                <label style={{ fontWeight: 600, fontSize: '13px', color: 'var(--a-text-secondary)', marginBottom: '6px', display: 'block' }}>รูปภาพ</label>
                                {form.image && (
                                    <div style={{ marginBottom: '8px', borderRadius: '10px', overflow: 'hidden', maxHeight: '150px' }}>
                                        <img src={form.image} alt="" style={{ width: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <label style={{
                                        flex: 1, padding: '10px', borderRadius: '8px', border: '2px dashed var(--a-border)',
                                        textAlign: 'center', cursor: 'pointer', fontSize: '13px', color: 'var(--a-text-muted)',
                                    }}>
                                        <Image size={16} style={{ marginRight: '4px' }} /> อัปโหลดรูป
                                        <input type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]) }} />
                                    </label>
                                    <input className="admin-input" style={{ flex: 2 }} value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} placeholder="หรือวาง URL รูป" />
                                </div>
                            </div>

                            <div className="input-group">
                                <label style={{ fontWeight: 600, fontSize: '13px', color: 'var(--a-text-secondary)', marginBottom: '6px', display: 'block' }}>คำอธิบาย</label>
                                <textarea className="admin-input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)" />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} id="active-check" />
                                <label htmlFor="active-check" style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>เปิดใช้งาน</label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button onClick={() => setShowModal(false)} className="btn-admin-secondary" style={{ flex: 1 }}>ยกเลิก</button>
                            <button onClick={saveVenue} className="btn-admin" style={{ flex: 1 }}><Save size={16} /> บันทึก</button>
                        </div>
                    </div>
                </div>
            )}
        </div></FadeIn>
    )
}
