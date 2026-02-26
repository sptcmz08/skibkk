'use client'

import { useState, useEffect } from 'react'
import { Shield, Plus, Trash2, X, Save, RefreshCw, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface SystemUser {
    id: string; name: string; email: string; phone: string; role: string; isActive: boolean; createdAt: string
    _count?: { bookings: number }
}

const ROLES = [
    { key: 'ADMIN', label: 'Admin', desc: 'จัดการระบบทั้งหมด' },
    { key: 'STAFF', label: 'Staff', desc: 'ดูข้อมูลและจัดการการจอง' },
    { key: 'SUPERUSER', label: 'Super Admin', desc: 'สิทธิ์สูงสุด' },
]

export default function UsersPage() {
    const [users, setUsers] = useState<SystemUser[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingUser, setEditingUser] = useState<SystemUser | null>(null)
    const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'STAFF' })

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/users?all=1', { cache: 'no-store' })
            const data = await res.json()
            setUsers(data.users || [])
        } catch { toast.error('โหลดข้อมูลไม่สำเร็จ') }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchUsers() }, [])

    const openAddModal = () => {
        setEditingUser(null)
        setForm({ name: '', email: '', password: '', phone: '', role: 'STAFF' })
        setShowModal(true)
    }

    const openEditModal = (u: SystemUser) => {
        setEditingUser(u)
        setForm({ name: u.name, email: u.email, password: '', phone: u.phone || '', role: u.role })
        setShowModal(true)
    }

    const handleSave = async () => {
        if (!form.name || !form.email) { toast.error('กรุณากรอกชื่อและอีเมล'); return }

        if (editingUser) {
            // Edit mode
            try {
                const body: Record<string, string> = {
                    userId: editingUser.id,
                    name: form.name,
                    email: form.email,
                    phone: form.phone,
                    role: form.role,
                }
                if (form.password) body.password = form.password

                const res = await fetch('/api/users', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                })
                const data = await res.json()
                if (!res.ok) { toast.error(data.error || 'แก้ไขไม่สำเร็จ'); return }
                toast.success('แก้ไขผู้ใช้สำเร็จ')
            } catch { toast.error('เกิดข้อผิดพลาด') }
        } else {
            // Add mode
            if (!form.password) { toast.error('กรุณากรอกรหัสผ่าน'); return }
            try {
                const res = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                })
                const data = await res.json()
                if (!res.ok) { toast.error(data.error || 'เพิ่มไม่สำเร็จ'); return }
                toast.success('เพิ่มผู้ใช้สำเร็จ')
            } catch { toast.error('เกิดข้อผิดพลาด') }
        }

        setShowModal(false)
        setEditingUser(null)
        fetchUsers()
    }

    const deleteUser = async (userId: string, userName: string) => {
        if (!confirm(`ต้องการลบ "${userName}" ออกจากระบบใช่ไหม? การกระทำนี้ไม่สามารถย้อนกลับได้`)) return
        try {
            const res = await fetch(`/api/users?id=${userId}`, { method: 'DELETE' })
            const data = await res.json()
            if (res.ok) {
                toast.success('ลบผู้ใช้สำเร็จ')
                fetchUsers()
            } else {
                toast.error(data.error || 'ลบไม่สำเร็จ')
            }
        } catch { toast.error('เกิดข้อผิดพลาด') }
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>ผู้ใช้งานระบบ ({users.length})</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>จัดการสิทธิ์และบทบาทของผู้ใช้งาน</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={fetchUsers} className="btn-admin-outline" style={{ padding: '8px' }}><RefreshCw size={16} /></button>
                    <button onClick={openAddModal} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={18} /> เพิ่มผู้ใช้
                    </button>
                </div>
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
                <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                        <thead>
                            <tr><th>ชื่อ</th><th>อีเมล</th><th>บทบาท</th><th>สถานะ</th><th>วันที่สร้าง</th><th>จัดการ</th></tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)', margin: '0 auto' }} /></td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>ยังไม่มีผู้ใช้งาน</td></tr>
                            ) : users.map(u => {
                                const c = roleColor(u.role)
                                return (
                                    <tr key={u.id}>
                                        <td style={{ fontWeight: 600 }}>{u.name}</td>
                                        <td>{u.email}</td>
                                        <td><span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: c.bg, color: c.text }}>{u.role}</span></td>
                                        <td><span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>{u.isActive ? 'Active' : 'Disabled'}</span></td>
                                        <td>{new Date(u.createdAt).toLocaleDateString('th-TH')}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button onClick={() => openEditModal(u)} style={{ padding: '4px 8px', background: 'var(--a-primary-light)', border: 'none', borderRadius: '6px', color: 'var(--a-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                                                    <Edit2 size={13} /> แก้ไข
                                                </button>
                                                {u.isActive && (
                                                    <button onClick={() => deleteUser(u.id, u.name)} style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--a-danger)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{editingUser ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <div style={{ display: 'grid', gap: '14px' }}>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>ชื่อ-สกุล</label><input className="admin-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>อีเมล</label><input type="email" className="admin-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                            <div className="input-group">
                                <label style={{ color: 'var(--a-text-secondary)' }}>
                                    {editingUser ? 'รหัสผ่านใหม่ (ไม่เปลี่ยนให้เว้นว่าง)' : 'รหัสผ่าน'}
                                </label>
                                <input type="password" className="admin-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={editingUser ? 'เว้นว่างถ้าไม่เปลี่ยน' : ''} />
                            </div>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>เบอร์โทร (ไม่บังคับ)</label><input className="admin-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>บทบาท</label>
                                <select className="admin-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                                    {ROLES.map(r => <option key={r.key} value={r.key}>{r.label} - {r.desc}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <button onClick={() => setShowModal(false)} className="btn-admin-outline">ยกเลิก</button>
                            <button onClick={handleSave} className="btn-admin"><Save size={16} /> บันทึก</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
