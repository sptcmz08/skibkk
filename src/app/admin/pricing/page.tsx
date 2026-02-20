'use client'

import { useState } from 'react'
import { DollarSign, Plus, Edit2, Trash2, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'

const DAYS = [
    { key: 'MONDAY', label: 'จ.' }, { key: 'TUESDAY', label: 'อ.' },
    { key: 'WEDNESDAY', label: 'พ.' }, { key: 'THURSDAY', label: 'พฤ.' },
    { key: 'FRIDAY', label: 'ศ.' }, { key: 'SATURDAY', label: 'ส.' },
    { key: 'SUNDAY', label: 'อา.' },
]

interface PricingRule {
    id: string; daysOfWeek: string[]; startTime: string; endTime: string; price: number; includesVat: boolean
}

export default function PricingPage() {
    const [rules, setRules] = useState<PricingRule[]>([
        { id: '1', daysOfWeek: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'], startTime: '09:00', endTime: '15:00', price: 1800, includesVat: false },
        { id: '2', daysOfWeek: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'], startTime: '15:00', endTime: '00:00', price: 2200, includesVat: false },
        { id: '3', daysOfWeek: ['SATURDAY', 'SUNDAY'], startTime: '09:00', endTime: '00:00', price: 2500, includesVat: false },
    ])
    const [showModal, setShowModal] = useState(false)
    const [editRule, setEditRule] = useState<PricingRule | null>(null)
    const [form, setForm] = useState({ daysOfWeek: [] as string[], startTime: '09:00', endTime: '00:00', price: '', includesVat: false })

    const openModal = (rule?: PricingRule) => {
        if (rule) {
            setEditRule(rule)
            setForm({ daysOfWeek: rule.daysOfWeek, startTime: rule.startTime, endTime: rule.endTime, price: rule.price.toString(), includesVat: rule.includesVat })
        } else {
            setEditRule(null)
            setForm({ daysOfWeek: [], startTime: '09:00', endTime: '00:00', price: '', includesVat: false })
        }
        setShowModal(true)
    }

    const toggleDay = (day: string) => {
        setForm(f => ({
            ...f,
            daysOfWeek: f.daysOfWeek.includes(day)
                ? f.daysOfWeek.filter(d => d !== day)
                : [...f.daysOfWeek, day],
        }))
    }

    const saveRule = () => {
        if (form.daysOfWeek.length === 0 || !form.price) { toast.error('กรุณากรอกข้อมูลให้ครบ'); return }
        if (editRule) {
            setRules(rules.map(r => r.id === editRule.id ? { ...r, ...form, price: parseFloat(form.price) } : r))
        } else {
            setRules([...rules, { id: Date.now().toString(), ...form, price: parseFloat(form.price) }])
        }
        setShowModal(false)
        toast.success('บันทึกราคาสำเร็จ')
    }

    const deleteRule = (id: string) => {
        setRules(rules.filter(r => r.id !== id))
        toast.success('ลบราคาแล้ว')
    }

    const getDayLabels = (days: string[]) => days.map(d => DAYS.find(dd => dd.key === d)?.label).join(', ')

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>กำหนดราคา</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>ตั้งราคาแยกตามวันและช่วงเวลา</p>
                </div>
                <button onClick={() => openModal()} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={18} /> เพิ่มราคา
                </button>
            </div>

            <div className="admin-card">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>วัน</th>
                            <th>ช่วงเวลา</th>
                            <th>ราคา (บาท/ชม.)</th>
                            <th>VAT</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rules.map(rule => (
                            <tr key={rule.id}>
                                <td>
                                    <div style={{ display: 'flex', gap: '4px' }}>
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
                                        <button onClick={() => deleteRule(rule.id)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--a-danger)', color: 'var(--a-danger)', background: 'white', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
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

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: 'var(--a-text-secondary)', fontSize: '14px' }}>เลือกวัน</label>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {DAYS.map(d => (
                                    <button key={d.key} onClick={() => toggleDay(d.key)}
                                        style={{
                                            padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
                                            background: form.daysOfWeek.includes(d.key) ? 'var(--a-primary)' : '#f0f0f0',
                                            color: form.daysOfWeek.includes(d.key) ? 'white' : 'var(--a-text)',
                                            border: 'none', transition: 'all 0.2s', fontFamily: 'inherit',
                                        }}>
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>เวลาเริ่ม</label><input type="time" className="admin-input" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} /></div>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>เวลาสิ้นสุด</label><input type="time" className="admin-input" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} /></div>
                        </div>

                        <div className="input-group" style={{ marginBottom: '16px' }}>
                            <label style={{ color: 'var(--a-text-secondary)' }}>ราคา (บาท/ชั่วโมง)</label>
                            <input type="number" className="admin-input" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0" />
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
        </div>
    )
}
