'use client'

import { useState } from 'react'
import { Shield, Plus, Edit2, Trash2, X, Save } from 'lucide-react'
import toast from 'react-hot-toast'

interface SystemUser {
    id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string
}

const ROLES = [
    { key: 'ADMIN', label: 'Admin', desc: 'จัดการระบบทั้งหมด' },
    { key: 'STAFF', label: 'Staff', desc: 'ดูข้อมูลและจัดการการจอง' },
    { key: 'SUPERUSER', label: 'Super Admin', desc: 'สิทธิ์สูงสุด' },
]

export default function UsersPage() {
    const [users, setUsers] = useState<SystemUser[]>([])
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF' })

    const addUser = () => {
        if (!form.name || !form.email || !form.password) { toast.error('กรุณากรอกข้อมูลให้ครบ'); return }
        setUsers([...users, { id: Date.now().toString(), name: form.name, email: form.email, role: form.role, isActive: true, createdAt: new Date().toISOString() }])
        setShowModal(false)
        toast.success('เพิ่มผู้ใช้สำเร็จ')
        setForm({ name: '', email: '', password: '', role: 'STAFF' })
    }

    const roleColor = (role: string) => {
        switch (role) {
            case 'SUPERUSER': return { bg: '#fde4de', text: '#c62828' }
            case 'ADMIN': return { bg: '#fef9e7', text: '#f39c12' }
            default: return { bg: '#e8f5e9', text: '#2e7d32' }
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>ผู้ใช้งานระบบ</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>จัดการสิทธิ์และบทบาทของผู้ใช้งาน</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={18} /> เพิ่มผู้ใช้
                </button>
            </div>

            {/* Roles explanation */}
            <div className="grid-3" style={{ marginBottom: '24px' }}>
                {ROLES.map(r => {
                    const c = roleColor(r.key)
                    return (
                        <div key={r.key} className="admin-card" style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <Shield size={16} style={{ color: c.text }} />
                                <span style={{ fontWeight: 700, color: c.text }}>{r.label}</span>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--a-text-muted)' }}>{r.desc}</p>
                        </div>
                    )
                })}
            </div>

            <div className="admin-card">
                <table className="admin-table">
                    <thead>
                        <tr><th>ชื่อ</th><th>อีเมล</th><th>บทบาท</th><th>สถานะ</th><th>วันที่สร้าง</th><th>จัดการ</th></tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>ยังไม่มีผู้ใช้งานเพิ่มเติม</td></tr>
                        ) : users.map(u => {
                            const c = roleColor(u.role)
                            return (
                                <tr key={u.id}>
                                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                                    <td>{u.email}</td>
                                    <td><span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: c.bg, color: c.text }}>{u.role}</span></td>
                                    <td><span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>{u.isActive ? 'Active' : 'Disabled'}</span></td>
                                    <td>{new Date(u.createdAt).toLocaleDateString('th-TH')}</td>
                                    <td><button style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--a-danger)', cursor: 'pointer' }}><Trash2 size={14} /></button></td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>เพิ่มผู้ใช้งาน</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <div style={{ display: 'grid', gap: '14px' }}>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>ชื่อ-สกุล</label><input className="admin-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>อีเมล</label><input type="email" className="admin-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>รหัสผ่าน</label><input type="password" className="admin-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>บทบาท</label>
                                <select className="admin-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                                    {ROLES.map(r => <option key={r.key} value={r.key}>{r.label} - {r.desc}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <button onClick={() => setShowModal(false)} className="btn-admin-outline">ยกเลิก</button>
                            <button onClick={addUser} className="btn-admin"><Save size={16} /> บันทึก</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
