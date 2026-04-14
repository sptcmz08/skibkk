'use client'

import { FadeIn } from '@/components/Motion'
import ConfirmModal from '@/components/ConfirmModal'
import DatePickerInput from '@/components/DatePickerInput'

import { useState, useEffect } from 'react'
import { Package, Plus, Trash2, Users, Clock, X, Save, Search, UserPlus, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface PackageItem {
    id: string; name: string; totalHours: number; price: number
    description: string | null; isActive: boolean; validDays: number
    validFrom: string | null; validTo: string | null
    _count?: { userPackages: number }
}

interface UserPkg {
    id: string; remainingHours: number; purchasedAt: string; expiresAt: string
    user: { id: string; name: string; email: string; phone: string }
    package: { id: string; name: string; totalHours: number; price: number }
}

interface CustomerResult {
    id: string; name: string; email: string; phone: string
}

export default function PackagesPage() {
    const [packages, setPackages] = useState<PackageItem[]>([])
    const [userPackages, setUserPackages] = useState<UserPkg[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm] = useState({ name: '', totalHours: '', price: '', description: '', validDays: '30', validFrom: '', validTo: '' })

    // Assign modal
    const [showAssign, setShowAssign] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<CustomerResult[]>([])
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null)
    const [selectedPkgId, setSelectedPkgId] = useState<string>('')
    const [assigning, setAssigning] = useState(false)
    const [pendingDeletePkg, setPendingDeletePkg] = useState<string | null>(null)
    const [pendingDeleteUserPkg, setPendingDeleteUserPkg] = useState<string | null>(null)

    const fetchData = async () => {
        setLoading(true)
        try {
            const [pkgRes, upRes] = await Promise.all([
                fetch('/api/packages', { cache: 'no-store' }),
                fetch('/api/admin/user-packages', { cache: 'no-store' }),
            ])
            const pkgData = await pkgRes.json()
            const upData = await upRes.json()
            setPackages(pkgData.packages || [])
            setUserPackages(upData.userPackages || [])
        } catch { /* ignore */ } finally { setLoading(false) }
    }

    useEffect(() => { fetchData() }, [])

    const handleSave = async () => {
        if (!form.name || !form.totalHours || !form.price) { toast.error('กรุณากรอกข้อมูลให้ครบ'); return }
        const body = { ...form, ...(editId ? { id: editId } : {}) }
        const res = await fetch('/api/packages', {
            method: editId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        if (res.ok) {
            toast.success(editId ? 'แก้ไขสำเร็จ' : 'เพิ่มแพ็คเกจสำเร็จ')
            setShowModal(false); setEditId(null)
            setForm({ name: '', totalHours: '', price: '', description: '', validDays: '30', validFrom: '', validTo: '' })
            fetchData()
        } else { toast.error('เกิดข้อผิดพลาด') }
    }

    const handleDelete = async (id: string) => {
        const res = await fetch('/api/packages', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        })
        if (res.ok) { toast.success('ลบแล้ว'); fetchData() } else { toast.error('ลบไม่สำเร็จ') }
        setPendingDeletePkg(null)
    }

    const openEdit = (pkg: PackageItem) => {
        setEditId(pkg.id)
        setForm({
            name: pkg.name, totalHours: pkg.totalHours.toString(),
            price: pkg.price.toString(), description: pkg.description || '',
            validDays: pkg.validDays.toString(),
            validFrom: pkg.validFrom ? pkg.validFrom.slice(0, 10) : '',
            validTo: pkg.validTo ? pkg.validTo.slice(0, 10) : '',
        })
        setShowModal(true)
    }

    // Search customers
    const searchCustomers = async (q: string) => {
        setSearchQuery(q)
        if (q.length < 2) { setSearchResults([]); return }
        try {
            const res = await fetch(`/api/users?search=${encodeURIComponent(q)}`)
            const data = await res.json()
            setSearchResults(data.users || [])
        } catch { /* ignore */ }
    }

    const handleAssign = async () => {
        if (!selectedCustomer || !selectedPkgId) { toast.error('เลือกลูกค้าและแพ็คเกจ'); return }
        setAssigning(true)
        try {
            const res = await fetch('/api/admin/user-packages', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: selectedCustomer.id, packageId: selectedPkgId }),
            })
            if (res.ok) {
                toast.success(`มอบแพ็คเกจให้ ${selectedCustomer.name} แล้ว`)
                setShowAssign(false); setSelectedCustomer(null); setSelectedPkgId('')
                setSearchQuery(''); setSearchResults([])
                fetchData()
            } else {
                const data = await res.json()
                toast.error(data.error || 'เกิดข้อผิดพลาด')
            }
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setAssigning(false) }
    }

    const handleDeleteUserPkg = async (id: string) => {
        const res = await fetch('/api/admin/user-packages', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        })
        if (res.ok) { toast.success('ยกเลิกแล้ว'); fetchData() } else { toast.error('เกิดข้อผิดพลาด') }
        setPendingDeleteUserPkg(null)
    }

    const isExpired = (d: string) => new Date(d) < new Date()

    if (loading) return <div style={{ textAlign: 'center', padding: '80px' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)' }} /></div>

    return (
        <FadeIn><div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>แพ็คเกจ ({packages.length})</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>จัดการแพ็คเกจรายชั่วโมงและมอบให้ลูกค้า</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setShowAssign(true)} className="btn-admin-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <UserPlus size={16} /> มอบแพ็คเกจให้ลูกค้า
                    </button>
                    <button onClick={() => { setEditId(null); setForm({ name: '', totalHours: '', price: '', description: '', validDays: '30', validFrom: '', validTo: '' }); setShowModal(true) }} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={18} /> เพิ่มแพ็คเกจ
                    </button>
                </div>
            </div>

            {/* Package cards */}
            {packages.length === 0 ? (
                <div className="admin-card" style={{ padding: '60px', textAlign: 'center' }}>
                    <Package size={48} style={{ color: '#ccc', marginBottom: '12px' }} />
                    <p style={{ color: 'var(--a-text-muted)', fontWeight: 600 }}>ยังไม่มีแพ็คเกจ</p>
                    <p style={{ color: 'var(--a-text-muted)', fontSize: '13px' }}>กดปุ่ม "เพิ่มแพ็คเกจ" เพื่อสร้างแพ็คเกจใหม่</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', marginBottom: '36px' }}>
                    {packages.map(pkg => (
                        <div key={pkg.id} className="admin-card" style={{ padding: '0', overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--a-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--a-primary-light)', color: 'var(--a-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Package size={20} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ fontWeight: 700, fontSize: '17px', color: 'var(--a-text)', lineHeight: 1.3, marginBottom: '4px' }}>{pkg.name}</h3>
                                            {pkg.description && (
                                                <p style={{ fontSize: '13px', color: 'var(--a-text-muted)', lineHeight: 1.4, margin: 0 }}>{pkg.description}</p>
                                            )}
                                            {(pkg.validFrom || pkg.validTo) && (
                                                <div style={{ fontSize: '12px', color: 'var(--a-primary)', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    📅 {pkg.validFrom ? new Date(pkg.validFrom).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '...'}
                                                    {' — '}
                                                    {pkg.validTo ? new Date(pkg.validTo).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '...'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                                        <button onClick={() => openEdit(pkg)} style={{ padding: '6px', background: 'none', border: 'none', color: 'var(--a-text-secondary)', cursor: 'pointer', borderRadius: '6px' }}><Edit2 size={15} /></button>
                                        <button onClick={() => setPendingDeletePkg(pkg.id)} style={{ padding: '6px', background: 'none', border: 'none', color: 'var(--a-danger)', cursor: 'pointer', borderRadius: '6px' }}><Trash2 size={15} /></button>
                                    </div>
                                </div>
                            </div>
                            {/* Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '16px 20px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontWeight: 800, fontSize: '22px', color: 'var(--a-text)', fontFamily: "'Inter', sans-serif" }}>{pkg.totalHours}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--a-text-muted)', fontWeight: 500 }}>ชั่วโมง</div>
                                </div>
                                <div style={{ textAlign: 'center', borderLeft: '1px solid var(--a-border)', borderRight: '1px solid var(--a-border)' }}>
                                    <div style={{ fontWeight: 800, fontSize: '22px', color: 'var(--a-text)', fontFamily: "'Inter', sans-serif" }}>{pkg._count?.userPackages || 0}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--a-text-muted)', fontWeight: 500 }}>ผู้ใช้งาน</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontWeight: 800, fontSize: '22px', color: 'var(--a-primary)', fontFamily: "'Inter', sans-serif" }}>฿{pkg.price.toLocaleString()}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--a-text-muted)', fontWeight: 500 }}>ราคา</div>
                                </div>
                            </div>
                            {/* Footer */}
                            <div style={{ padding: '10px 20px', background: '#fafafa', borderTop: '1px solid var(--a-border)', fontSize: '12px', color: 'var(--a-text-muted)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                <Clock size={12} /> อายุแพ็คเกจ {pkg.validDays} วัน
                                {!pkg.isActive && <span style={{ color: 'var(--a-danger)', fontWeight: 700 }}>⛔ ปิดใช้งาน</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* User Packages Table */}
            <div className="admin-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={20} style={{ color: 'var(--a-primary)' }} /> ลูกค้าที่มีแพ็คเกจ ({userPackages.length})
                </h3>
                {userPackages.length === 0 ? (
                    <p style={{ color: 'var(--a-text-muted)', textAlign: 'center', padding: '32px', fontSize: '14px' }}>ยังไม่มีลูกค้าที่มีแพ็คเกจ</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="admin-table" style={{ width: '100%', fontSize: '14px' }}>
                            <thead>
                                <tr>
                                    <th>ลูกค้า</th>
                                    <th>แพ็คเกจ</th>
                                    <th>ชม.เหลือ</th>
                                    <th>วันที่ซื้อ</th>
                                    <th>หมดอายุ</th>
                                    <th>สถานะ</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {userPackages.map(up => {
                                    const expired = isExpired(up.expiresAt)
                                    const empty = up.remainingHours <= 0
                                    return (
                                        <tr key={up.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{up.user.name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>{up.user.phone || up.user.email}</div>
                                            </td>
                                            <td>{up.package.name}</td>
                                            <td>
                                                <span style={{ fontWeight: 700, color: empty ? 'var(--a-danger)' : 'var(--a-text)' }}>
                                                    {up.remainingHours}/{up.package.totalHours} ชม.
                                                </span>
                                            </td>
                                            <td>{new Date(up.purchasedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                                            <td>{new Date(up.expiresAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                                            <td>
                                                {expired ? (
                                                    <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', background: '#fde8e8', color: '#e74c3c', fontWeight: 600 }}>หมดอายุ</span>
                                                ) : empty ? (
                                                    <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', background: '#fef3cd', color: '#e67e22', fontWeight: 600 }}>ใช้หมด</span>
                                                ) : (
                                                    <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', background: '#d4edda', color: '#27ae60', fontWeight: 600 }}>ใช้งานอยู่</span>
                                                )}
                                            </td>
                                            <td>
                                                <button onClick={() => setPendingDeleteUserPkg(up.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-danger)' }}><Trash2 size={14} /></button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Package Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{editId ? 'แก้ไขแพ็คเกจ' : 'เพิ่มแพ็คเกจใหม่'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <div style={{ display: 'grid', gap: '14px' }}>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>ชื่อแพ็คเกจ *</label><input className="admin-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="เช่น แพ็คเกจ 10 ชั่วโมง" /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>จำนวนชั่วโมง *</label><input type="number" className="admin-input" value={form.totalHours} onChange={e => setForm({ ...form, totalHours: e.target.value })} /></div>
                                <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>ราคา (บาท) *</label><input type="number" className="admin-input" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
                            </div>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>อายุแพ็คเกจ (วัน)</label><input type="number" className="admin-input" value={form.validDays} onChange={e => setForm({ ...form, validDays: e.target.value })} /></div>
                            <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>คำอธิบาย</label><input className="admin-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="เช่น ซื้อ 10 ชม. ลด 15%" /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>วันเริ่มต้นใช้งาน</label><DatePickerInput value={form.validFrom} onChange={value => setForm({ ...form, validFrom: value })} style={{ width: '100%' }} popupPlacement="top" /></div>
                                <div className="input-group"><label style={{ color: 'var(--a-text-secondary)' }}>วันสิ้นสุดใช้งาน</label><DatePickerInput value={form.validTo} onChange={value => setForm({ ...form, validTo: value })} style={{ width: '100%' }} popupPlacement="top" /></div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <button onClick={() => setShowModal(false)} className="btn-admin-outline">ยกเลิก</button>
                            <button onClick={handleSave} className="btn-admin"><Save size={16} /> บันทึก</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Package Modal */}
            {showAssign && (
                <div className="modal-overlay" onClick={() => setShowAssign(false)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>มอบแพ็คเกจให้ลูกค้า</h2>
                            <button onClick={() => setShowAssign(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        {/* Search customer */}
                        <div className="input-group" style={{ marginBottom: '16px' }}>
                            <label style={{ color: 'var(--a-text-secondary)' }}>ค้นหาลูกค้า (ชื่อ / เบอร์โทร / อีเมล)</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
                                <input className="admin-input" style={{ paddingLeft: '36px' }} placeholder="พิมพ์ค้นหา..." value={searchQuery} onChange={e => searchCustomers(e.target.value)} />
                            </div>
                            {searchResults.length > 0 && !selectedCustomer && (
                                <div style={{ border: '1px solid #e9ecef', borderRadius: '8px', marginTop: '4px', maxHeight: '200px', overflow: 'auto' }}>
                                    {searchResults.map(c => (
                                        <div key={c.id} onClick={() => { setSelectedCustomer(c); setSearchResults([]) }}
                                            style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f2f6', display: 'flex', justifyContent: 'space-between' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fa')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                                        >
                                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                                            <span style={{ fontSize: '13px', color: '#636e72' }}>{c.phone || c.email}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Selected customer */}
                        {selectedCustomer && (
                            <div style={{ padding: '12px 16px', background: '#f0fff4', borderRadius: '10px', border: '1px solid #c6f6d5', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 700, color: '#2d3436' }}>{selectedCustomer.name}</div>
                                    <div style={{ fontSize: '13px', color: '#636e72' }}>{selectedCustomer.phone || selectedCustomer.email}</div>
                                </div>
                                <button onClick={() => { setSelectedCustomer(null); setSearchQuery('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#636e72' }}><X size={16} /></button>
                            </div>
                        )}

                        {/* Select package */}
                        <div className="input-group" style={{ marginBottom: '16px' }}>
                            <label style={{ color: 'var(--a-text-secondary)' }}>เลือกแพ็คเกจ</label>
                            {packages.filter(p => p.isActive).length === 0 ? (
                                <p style={{ fontSize: '13px', color: 'var(--a-danger)' }}>ยังไม่มีแพ็คเกจ กรุณาสร้างแพ็คเกจก่อน</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {packages.filter(p => p.isActive).map(pkg => (
                                        <div key={pkg.id} onClick={() => setSelectedPkgId(pkg.id)}
                                            style={{
                                                padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                                                border: selectedPkgId === pkg.id ? '2px solid var(--a-primary)' : '1px solid #e9ecef',
                                                background: selectedPkgId === pkg.id ? 'var(--a-primary-light)' : 'white',
                                            }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontWeight: 700 }}>{pkg.name}</span>
                                                <span style={{ fontWeight: 700, color: 'var(--a-primary)' }}>฿{pkg.price.toLocaleString()}</span>
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#636e72', marginTop: '4px' }}>{pkg.totalHours} ชม. • อายุ {pkg.validDays} วัน</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <button onClick={() => setShowAssign(false)} className="btn-admin-outline">ยกเลิก</button>
                            <button onClick={handleAssign} className="btn-admin" disabled={assigning || !selectedCustomer || !selectedPkgId}>
                                {assigning ? 'กำลังบันทึก...' : <><UserPlus size={16} /> มอบแพ็คเกจ</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={!!pendingDeletePkg}
                title="ลบแพ็คเกจ"
                message="ลบแพ็คเกจนี้ออกจากระบบ?"
                confirmText="ลบ"
                type="danger"
                icon="📦"
                onConfirm={() => pendingDeletePkg && handleDelete(pendingDeletePkg)}
                onCancel={() => setPendingDeletePkg(null)}
            />

            <ConfirmModal
                open={!!pendingDeleteUserPkg}
                title="ยกเลิกแพ็คเกจ"
                message="ยกเลิกแพ็คเกจนี้จากลูกค้า?"
                confirmText="ยกเลิก"
                type="warning"
                icon="📦"
                onConfirm={() => pendingDeleteUserPkg && handleDeleteUserPkg(pendingDeleteUserPkg)}
                onCancel={() => setPendingDeleteUserPkg(null)}
            />
        </div></FadeIn>
    )
}
