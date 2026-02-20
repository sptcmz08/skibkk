'use client'

import { useState } from 'react'
import { Package, Plus, Edit2, Trash2, Users, Clock, X, Save } from 'lucide-react'
import toast from 'react-hot-toast'

interface PackageItem {
    id: string; name: string; hours: number; maxParticipants: number
    price: number; description: string; isActive: boolean; validDays: number
}

export default function PackagesPage() {
    const [packages, setPackages] = useState<PackageItem[]>([
        { id: '1', name: 'แพ็คเกจ 10 ชั่วโมง', hours: 10, maxParticipants: 2, price: 16000, description: 'ซื้อ 10 ชม. ลด 15%', isActive: true, validDays: 90 },
        { id: '2', name: 'แพ็คเกจ 20 ชั่วโมง', hours: 20, maxParticipants: 2, price: 28000, description: 'ซื้อ 20 ชม. ลด 25%', isActive: true, validDays: 180 },
        { id: '3', name: 'แพ็คเกจครอบครัว', hours: 5, maxParticipants: 4, price: 12000, description: 'สำหรับ 4 คน', isActive: true, validDays: 60 },
    ])
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ name: '', hours: '', maxParticipants: '2', price: '', description: '', validDays: '90' })

    const addPackage = () => {
        if (!form.name || !form.hours || !form.price) { toast.error('กรุณากรอกข้อมูลให้ครบ'); return }
        setPackages([...packages, {
            id: Date.now().toString(), name: form.name, hours: parseInt(form.hours),
            maxParticipants: parseInt(form.maxParticipants), price: parseFloat(form.price),
            description: form.description, isActive: true, validDays: parseInt(form.validDays),
        }])
        setShowModal(false)
        toast.success('เพิ่มแพ็คเกจสำเร็จ')
    }

    const deletePackage = (id: string) => {
        setPackages(packages.filter(p => p.id !== id))
        toast.success('ลบแพ็คเกจแล้ว')
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>แพ็คเกจ ({packages.length})</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>จัดการแพ็คเกจรายชั่วโมงและข้อเสนอพิเศษ</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={18} /> เพิ่มแพ็คเกจ
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {packages.map(pkg => (
                    <div key={pkg.id} className="admin-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--a-primary-light)', color: 'var(--a-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Package size={22} />
                                </div>
                                <div>
                                    <h3 style={{ fontWeight: 700, color: 'var(--a-text)' }}>{pkg.name}</h3>
                                    <p style={{ fontSize: '13px', color: 'var(--a-text-muted)' }}>{pkg.description}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => deletePackage(pkg.id)} style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--a-danger)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
                            <div style={{ textAlign: 'center', padding: '10px', borderRadius: '8px', background: '#f8f9fa' }}>
                                <Clock size={16} style={{ color: 'var(--a-primary)', margin: '0 auto 4px' }} />
                                <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--a-text)' }}>{pkg.hours}</div>
                                <div style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}>ชั่วโมง</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '10px', borderRadius: '8px', background: '#f8f9fa' }}>
                                <Users size={16} style={{ color: 'var(--a-primary)', margin: '0 auto 4px' }} />
                                <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--a-text)' }}>{pkg.maxParticipants}</div>
                                <div style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}>คน/ชม.</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '10px', borderRadius: '8px', background: '#fef9e7' }}>
                                <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--a-primary)' }}>฿{pkg.price.toLocaleString()}</div>
                                <div style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}>ราคา</div>
                            </div>
                        </div>
                        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--a-text-muted)', textAlign: 'center' }}>
                            อายุแพ็คเกจ {pkg.validDays} วัน
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>เพิ่มแพ็คเกจใหม่</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <div style={{ display: 'grid', gap: '14px' }}>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>ชื่อแพ็คเกจ</label><input className="admin-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>จำนวนชั่วโมง</label><input type="number" className="admin-input" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} /></div>
                                <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>จำนวนคนต่อชม.</label><input type="number" className="admin-input" value={form.maxParticipants} onChange={e => setForm({ ...form, maxParticipants: e.target.value })} /></div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>ราคา (บาท)</label><input type="number" className="admin-input" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
                                <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>อายุ (วัน)</label><input type="number" className="admin-input" value={form.validDays} onChange={e => setForm({ ...form, validDays: e.target.value })} /></div>
                            </div>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>คำอธิบาย</label><input className="admin-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <button onClick={() => setShowModal(false)} className="btn-admin-outline">ยกเลิก</button>
                            <button onClick={addPackage} className="btn-admin"><Save size={16} /> บันทึก</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
