'use client'

import { FadeIn } from '@/components/Motion'
import ConfirmModal from '@/components/ConfirmModal'

import { useState, useEffect } from 'react'
import { DollarSign, Plus, Edit2, Trash2, Save, X, Clock, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'

const DAYS = [
    { key: 'MONDAY', label: 'จ.' }, { key: 'TUESDAY', label: 'อ.' },
    { key: 'WEDNESDAY', label: 'พ.' }, { key: 'THURSDAY', label: 'พฤ.' },
    { key: 'FRIDAY', label: 'ศ.' }, { key: 'SATURDAY', label: 'ส.' },
    { key: 'SUNDAY', label: 'อา.' },
]

interface OperatingHour {
    dayOfWeek: string
    openTime: string
    closeTime: string
    isClosed: boolean
}

interface Court {
    id: string; name: string; venue?: { name: string }; operatingHours?: OperatingHour[]
}

interface PricingRule {
    id: string; courtId: string | null; court?: { name: string; venue?: { name: string } }; daysOfWeek: string[]; startTime: string; endTime: string; price: number; includesVat: boolean
}

export default function PricingPage() {
    const [rules, setRules] = useState<PricingRule[]>([])
    const [courts, setCourts] = useState<Court[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchPricingRules()
        fetchCourts()
    }, [])

    const fetchPricingRules = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/pricing-rules', { cache: 'no-store' })
            if (res.ok) {
                const data = await res.json()
                setRules(data.rules || [])
            }
        } catch (error) {
            toast.error('โหลดข้อมูลผิดพลาด')
        } finally {
            setLoading(false)
        }
    }

    const fetchCourts = async () => {
        try {
            const res = await fetch('/api/courts?admin=1', { cache: 'no-store' })
            if (res.ok) {
                const data = await res.json()
                setCourts(data.courts || [])
            }
        } catch { /* ignore */ }
    }

    const [showModal, setShowModal] = useState(false)
    const [editRule, setEditRule] = useState<PricingRule | null>(null)
    const [form, setForm] = useState({ courtId: '' as string, daysOfWeek: [] as string[], startTime: '09:00', endTime: '00:00', price: '', includesVat: false })
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

    // Get operating hours for selected court
    const selectedCourt = courts.find(c => c.id === form.courtId)
    const courtHours = selectedCourt?.operatingHours || []
    const openDays = courtHours.filter(h => !h.isClosed).map(h => h.dayOfWeek)
    // Get the common open/close time from operating hours
    const firstOpenHour = courtHours.find(h => !h.isClosed)

    const openModal = (rule?: PricingRule) => {
        if (rule) {
            setEditRule(rule)
            setForm({ courtId: rule.courtId || '', daysOfWeek: rule.daysOfWeek, startTime: rule.startTime, endTime: rule.endTime, price: rule.price.toString(), includesVat: rule.includesVat })
        } else {
            setEditRule(null)
            setForm({ courtId: '', daysOfWeek: [], startTime: '09:00', endTime: '00:00', price: '', includesVat: false })
        }
        setShowModal(true)
    }

    // Auto-fill days and times when court changes
    const handleCourtChange = (courtId: string) => {
        const court = courts.find(c => c.id === courtId)
        if (court && court.operatingHours) {
            const hours = court.operatingHours.filter(h => !h.isClosed)
            const days = hours.map(h => h.dayOfWeek)
            const first = hours[0]
            setForm(f => ({
                ...f,
                courtId,
                daysOfWeek: days,
                startTime: first?.openTime || '09:00',
                endTime: first?.closeTime || '00:00',
            }))
        } else {
            setForm(f => ({ ...f, courtId, daysOfWeek: [], startTime: '09:00', endTime: '00:00' }))
        }
    }

    const saveRule = async () => {
        if (form.daysOfWeek.length === 0 || !form.price) { toast.error('กรุณากรอกข้อมูลให้ครบ'); return }

        try {
            if (editRule) {
                const res = await fetch('/api/pricing-rules', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editRule.id, ...form, courtId: form.courtId || null, price: parseFloat(form.price) })
                })
                if (res.ok) {
                    const data = await res.json()
                    setRules(rules.map(r => r.id === editRule.id ? data.rule : r))
                    toast.success('บันทึกราคาสำเร็จ')
                } else {
                    toast.error('ไม่สามารถบันทึกได้')
                }
            } else {
                const res = await fetch('/api/pricing-rules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...form, courtId: form.courtId || null, price: parseFloat(form.price) })
                })
                if (res.ok) {
                    const data = await res.json()
                    setRules([...rules, data.rule])
                    toast.success('บันทึกราคาสำเร็จ')
                } else {
                    toast.error('ไม่สามารถบันทึกได้')
                }
            }
            setShowModal(false)
        } catch (error) {
            toast.error('เกิดข้อผิดพลาด')
        }
    }

    const deleteRule = async (id: string) => {

        try {
            const res = await fetch('/api/pricing-rules', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            })
            if (res.ok) {
                setRules(rules.filter(r => r.id !== id))
                toast.success('ลบราคาแล้ว')
            } else {
                toast.error('ไม่สามารถลบได้')
            }
        } catch (error) {
            toast.error('เกิดข้อผิดพลาด')
        } finally { setPendingDeleteId(null) }
    }

    return (
        <FadeIn><div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>กำหนดราคา</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>ราคาเชื่อมกับวัน-เวลาเปิดปิดสนามอัตโนมัติ</p>
                </div>
                <button onClick={() => openModal()} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={18} /> เพิ่มราคา
                </button>
            </div>

            <div className="admin-card">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>สนาม</th>
                            <th>วัน</th>
                            <th>ช่วงเวลา</th>
                            <th>ราคา (บาท/ชม.)</th>
                            <th>VAT</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && rules.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>กำลังโหลดข้อมูล...</td></tr>
                        ) : rules.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#888' }}>ยังไม่มีการกำหนดราคา</td></tr>
                        ) : (
                            rules.map(rule => (
                                <tr key={rule.id}>
                                    <td>
                                        <span style={{ fontWeight: 600, color: rule.courtId ? 'var(--a-primary)' : '#888' }}>
                                            {rule.court ? `${rule.court.venue?.name ? rule.court.venue.name + ' / ' : ''}${rule.court.name}` : 'ทุกสนาม'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            {rule.daysOfWeek.map(d => (
                                                <span key={d} style={{
                                                    padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                                                    background: 'var(--a-primary-light)', color: 'var(--a-primary)',
                                                }}>
                                                    {DAYS.find(dd => dd.key === d)?.label}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{rule.startTime} - {rule.endTime}</td>
                                    <td style={{ fontWeight: 800, fontSize: '16px', color: 'var(--a-primary)' }}>฿{rule.price.toLocaleString()}</td>
                                    <td>{rule.includesVat ? <span className="badge badge-success">รวม VAT</span> : <span className="badge badge-warning">ไม่รวม</span>}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={() => openModal(rule)} className="btn-admin-outline" style={{ padding: '4px 10px' }}><Edit2 size={14} /></button>
                                            <button onClick={() => setPendingDeleteId(rule.id)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--a-danger)', color: 'var(--a-danger)', background: 'white', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{editRule ? 'แก้ไขราคา' : 'เพิ่มราคาใหม่'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        {/* Court selector */}
                        <div className="input-group" style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: 'var(--a-text-secondary)', fontSize: '14px' }}>เลือกสนาม</label>
                            <select className="admin-input" value={form.courtId} onChange={e => handleCourtChange(e.target.value)}>
                                <option value="">ทุกสนาม (ราคาเดียวกัน)</option>
                                {courts.map(c => (
                                    <option key={c.id} value={c.id}>{c.venue?.name ? c.venue.name + ' / ' : ''}{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Auto-linked operating hours info */}
                        {form.courtId && selectedCourt && (
                            <div style={{
                                background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)',
                                borderRadius: '12px', padding: '16px', marginBottom: '20px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                                    <Clock size={14} style={{ color: '#f5a623' }} />
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#f5a623' }}>
                                        เลือกวันที่ต้องการกำหนดราคา
                                    </span>
                                </div>

                                {/* Days — clickable toggles */}
                                <div style={{ marginBottom: '10px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--a-text-muted)', marginRight: '8px', display: 'block', marginBottom: '6px' }}>
                                        กดเลือก/ยกเลิกวันที่ต้องการ:
                                    </span>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {DAYS.map(d => {
                                            const isOpen = openDays.includes(d.key)
                                            const isSelected = form.daysOfWeek.includes(d.key)
                                            return (
                                                <button key={d.key}
                                                    onClick={() => {
                                                        if (!isOpen) return // Can't select closed days
                                                        setForm(f => ({
                                                            ...f,
                                                            daysOfWeek: isSelected
                                                                ? f.daysOfWeek.filter(dd => dd !== d.key)
                                                                : [...f.daysOfWeek, d.key],
                                                        }))
                                                    }}
                                                    style={{
                                                        padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                                                        border: 'none', cursor: isOpen ? 'pointer' : 'not-allowed',
                                                        background: !isOpen ? '#e9ecef' : isSelected ? 'var(--a-primary)' : 'rgba(245,166,35,0.15)',
                                                        color: !isOpen ? '#bbb' : isSelected ? 'white' : 'var(--a-primary)',
                                                        transition: 'all 0.15s', fontFamily: 'inherit',
                                                        opacity: !isOpen ? 0.5 : 1,
                                                    }}
                                                >
                                                    {d.label} {isSelected && '✓'}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginTop: '8px' }}>
                                        💡 เลือกบางวัน แล้วเพิ่มอีก rule สำหรับวันอื่นในราคาต่างกันได้
                                    </div>
                                </div>

                                {/* Editable start/end time */}
                                <div style={{ marginTop: '12px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--a-text-muted)', display: 'block', marginBottom: '6px' }}>ช่วงเวลา:</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <select className="admin-input" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })}
                                            style={{ fontSize: '14px', fontWeight: 700, flex: 1 }}>
                                            {(() => {
                                                const openH = firstOpenHour ? parseInt(firstOpenHour.openTime.split(':')[0]) : 0
                                                const closeH = firstOpenHour ? (parseInt(firstOpenHour.closeTime.split(':')[0]) || 24) : 24
                                                const opts = []
                                                for (let h = openH; h < closeH; h++) {
                                                    const t = `${String(h).padStart(2, '0')}:00`
                                                    opts.push(<option key={t} value={t}>{t}</option>)
                                                }
                                                return opts
                                            })()}
                                        </select>
                                        <span style={{ fontWeight: 700, color: 'var(--a-text-muted)' }}>ถึง</span>
                                        <select className="admin-input" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })}
                                            style={{ fontSize: '14px', fontWeight: 700, flex: 1 }}>
                                            {(() => {
                                                const startH = parseInt(form.startTime.split(':')[0]) + 1
                                                const closeH = firstOpenHour ? (parseInt(firstOpenHour.closeTime.split(':')[0]) || 24) : 24
                                                const opts = []
                                                for (let h = startH; h <= closeH; h++) {
                                                    const t = h === 24 ? '00:00' : `${String(h).padStart(2, '0')}:00`
                                                    opts.push(<option key={t} value={t}>{t === '00:00' ? '00:00 (เที่ยงคืน)' : t}</option>)
                                                }
                                                return opts
                                            })()}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* No court selected — manual time input */}
                        {!form.courtId && (
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: 'var(--a-text-secondary)', fontSize: '14px' }}>ช่วงเวลา</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <select className="admin-input" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })}
                                        style={{ fontSize: '14px', fontWeight: 700, flex: 1 }}>
                                        {Array.from({ length: 24 }, (_, h) => {
                                            const t = `${String(h).padStart(2, '0')}:00`
                                            return <option key={t} value={t}>{t}</option>
                                        })}
                                    </select>
                                    <span style={{ fontWeight: 700, color: 'var(--a-text-muted)' }}>ถึง</span>
                                    <select className="admin-input" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })}
                                        style={{ fontSize: '14px', fontWeight: 700, flex: 1 }}>
                                        {Array.from({ length: 24 }, (_, h) => {
                                            const hr = h + 1
                                            const t = hr === 24 ? '00:00' : `${String(hr).padStart(2, '0')}:00`
                                            return <option key={t} value={t}>{t === '00:00' ? '00:00 (เที่ยงคืน)' : t}</option>
                                        })}
                                    </select>
                                </div>

                                {/* Day selector for no court */}
                                <div style={{ marginTop: '12px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--a-text-muted)', display: 'block', marginBottom: '6px' }}>เลือกวัน:</span>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {DAYS.map(d => {
                                            const isSelected = form.daysOfWeek.includes(d.key)
                                            return (
                                                <button key={d.key}
                                                    onClick={() => setForm(f => ({
                                                        ...f,
                                                        daysOfWeek: isSelected ? f.daysOfWeek.filter(dd => dd !== d.key) : [...f.daysOfWeek, d.key],
                                                    }))}
                                                    style={{
                                                        padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                                                        border: 'none', cursor: 'pointer',
                                                        background: isSelected ? 'var(--a-primary)' : 'rgba(245,166,35,0.15)',
                                                        color: isSelected ? 'white' : 'var(--a-primary)',
                                                        transition: 'all 0.15s', fontFamily: 'inherit',
                                                    }}
                                                >
                                                    {d.label} {isSelected && '✓'}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Price */}
                        <div className="input-group" style={{ marginBottom: '16px' }}>
                            <label style={{ color: 'var(--a-text-secondary)', fontWeight: 600, fontSize: '14px' }}>ราคา (บาท/ชั่วโมง)</label>
                            <input type="number" className="admin-input" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0"
                                style={{ fontSize: '20px', fontWeight: 700, textAlign: 'center', padding: '14px' }} />
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.includesVat} onChange={e => setForm({ ...form, includesVat: e.target.checked })} style={{ accentColor: 'var(--a-primary)', width: '18px', height: '18px' }} />
                            <span style={{ fontWeight: 500, fontSize: '14px' }}>ราคารวม VAT 7%</span>
                        </label>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowModal(false)} className="btn-admin-outline">ยกเลิก</button>
                            <button onClick={saveRule} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Save size={16} /> บันทึก</button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={!!pendingDeleteId}
                title="ลบราคา"
                message="ยืนยันการลบราคานี้?"
                confirmText="ลบราคา"
                type="danger"
                icon="💰"
                onConfirm={() => pendingDeleteId && deleteRule(pendingDeleteId)}
                onCancel={() => setPendingDeleteId(null)}
            />
        </div></FadeIn >
    )
}
