'use client'

import { FadeIn } from '@/components/Motion'

import { useState, useEffect } from 'react'
import { Users, Search, Phone, Mail, Calendar, ChevronLeft, Clock, MapPin, X, Edit2, Save } from 'lucide-react'
import toast from 'react-hot-toast'

interface Customer {
    id: string; name: string; email: string; phone: string; role: string; isActive: boolean
    createdAt: string; bookingCount: number; lineAvatar?: string; lineUserId?: string; lineDisplayName?: string
}

interface BookingDetail {
    id: string; bookingNumber: string; status: string; totalAmount: number; createdAt: string
    bookingItems: Array<{ date: string; startTime: string; endTime: string; price: number; court: { name: string } }>
    payments: Array<{ method: string; status: string; amount: number; createdAt: string }>
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [bookings, setBookings] = useState<BookingDetail[]>([])
    const [loadingBookings, setLoadingBookings] = useState(false)
    const [editBooking, setEditBooking] = useState<BookingDetail | null>(null)
    const [editStatus, setEditStatus] = useState('')
    const [editAmount, setEditAmount] = useState(0)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetch('/api/bookings?take=500', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                if (data.bookings) {
                    const usersMap = new Map<string, Customer>()
                    data.bookings.forEach((b: any) => {
                        if (b.user) {
                            const existing = usersMap.get(b.user.id)
                            if (existing) {
                                existing.bookingCount++
                            } else {
                                usersMap.set(b.user.id, { ...b.user, bookingCount: 1, role: 'CUSTOMER', isActive: true, createdAt: b.createdAt })
                            }
                        }
                    })
                    setCustomers(Array.from(usersMap.values()))
                }
            })
            .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
            .finally(() => setLoading(false))
    }, [])

    const filtered = customers.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
    )

    const viewCustomerHistory = async (customer: Customer) => {
        setSelectedCustomer(customer)
        setLoadingBookings(true)
        try {
            const res = await fetch(`/api/bookings?search=${encodeURIComponent(customer.name)}`, { cache: 'no-store' })
            const data = await res.json()
            // Filter to only this customer's bookings
            const customerBookings = (data.bookings || []).filter((b: any) => b.user?.id === customer.id)
            setBookings(customerBookings)
        } catch { toast.error('โหลดประวัติไม่สำเร็จ') }
        finally { setLoadingBookings(false) }
    }

    const statusBadge = (status: string) => {
        switch (status) {
            case 'CONFIRMED': return { label: 'ยืนยันแล้ว', cls: 'badge-success' }
            case 'CANCELLED': return { label: 'ยกเลิก', cls: 'badge-danger' }
            default: return { label: 'รอดำเนินการ', cls: 'badge-warning' }
        }
    }

    // ── Customer Detail View ──
    if (selectedCustomer) {
        const totalSpent = bookings.filter(b => b.status === 'CONFIRMED').reduce((s, b) => s + b.totalAmount, 0)
        const totalHours = bookings.filter(b => b.status === 'CONFIRMED').reduce((s, b) => s + b.bookingItems.length, 0)

        return (
            <div>
                <button onClick={() => setSelectedCustomer(null)} className="btn-admin-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
                    <ChevronLeft size={16} /> กลับรายชื่อ
                </button>

                {/* Customer header */}
                <div className="admin-card" style={{ padding: '24px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {selectedCustomer.lineAvatar ? (
                            <img src={selectedCustomer.lineAvatar} alt="" style={{ width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'var(--a-primary-light)', color: 'var(--a-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '22px' }}>
                                {selectedCustomer.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                        )}
                        <div>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>{selectedCustomer.name}</h2>
                            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--a-text-muted)', marginTop: '4px', flexWrap: 'wrap' }}>
                                {selectedCustomer.email && !selectedCustomer.email.endsWith('@line.local') && <span><Mail size={13} style={{ marginRight: '4px' }} />{selectedCustomer.email}</span>}
                                {selectedCustomer.phone && !selectedCustomer.phone.startsWith('LINE-') && <span><Phone size={13} style={{ marginRight: '4px' }} />{selectedCustomer.phone}</span>}
                                {selectedCustomer.lineUserId && <span style={{ color: '#06c755' }}>LINE: {selectedCustomer.lineDisplayName || '-'}</span>}
                            </div>
                            {selectedCustomer.lineUserId && (
                                <div style={{ fontSize: '12px', color: '#06c755', marginTop: '2px', fontFamily: "'Inter', monospace" }}>ID: {selectedCustomer.lineUserId}</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid-3" style={{ marginBottom: '20px' }}>
                    <div className="stat-card"><div className="stat-icon blue"><Calendar size={20} /></div><div><div className="stat-value">{bookings.length}</div><div className="stat-label">จองทั้งหมด</div></div></div>
                    <div className="stat-card"><div className="stat-icon green"><Clock size={20} /></div><div><div className="stat-value">{totalHours} ชม.</div><div className="stat-label">ชม.สนามรวม</div></div></div>
                    <div className="stat-card"><div className="stat-icon yellow"><MapPin size={20} /></div><div><div className="stat-value">฿{totalSpent.toLocaleString()}</div><div className="stat-label">ยอดรวม</div></div></div>
                </div>

                {/* Booking history */}
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3 className="admin-card-title">ประวัติการจอง</h3>
                        <span className="badge badge-info">{bookings.length} รายการ (กดเพื่อแก้ไข)</span>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr><th>เลขที่</th><th>วันที่จอง</th><th>สนาม</th><th>เวลา</th><th>ยอด</th><th>สถานะ</th><th></th></tr>
                        </thead>
                        <tbody>
                            {loadingBookings ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)', margin: '0 auto' }} /></td></tr>
                            ) : bookings.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>ไม่มีประวัติการจอง</td></tr>
                            ) : bookings.map(b => {
                                const badge = statusBadge(b.status)
                                return (
                                    <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => { setEditBooking(b); setEditStatus(b.status); setEditAmount(b.totalAmount) }}>
                                        <td style={{ fontWeight: 600, fontFamily: "'Inter'" }}>{b.bookingNumber}</td>
                                        <td>{b.bookingItems[0] ? new Date(b.bookingItems[0].date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '-'}</td>
                                        <td>{b.bookingItems.map(i => i.court.name).join(', ')}</td>
                                        <td>{b.bookingItems.map(i => `${i.startTime}-${i.endTime}`).join(', ')}</td>
                                        <td style={{ fontWeight: 700 }}>฿{b.totalAmount.toLocaleString()}</td>
                                        <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                                        <td><Edit2 size={14} style={{ color: 'var(--a-primary)' }} /></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Edit Booking Modal */}
                {editBooking && (
                    <div className="modal-overlay" onClick={() => setEditBooking(null)}>
                        <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>แก้ไขการจอง</h2>
                                <button onClick={() => setEditBooking(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                            </div>
                            <div style={{ background: '#f8f9fa', padding: '14px', borderRadius: '10px', marginBottom: '16px', fontSize: '14px' }}>
                                <div><strong>เลขจอง:</strong> {editBooking.bookingNumber}</div>
                                <div style={{ marginTop: '6px' }}><strong>สนาม:</strong> {editBooking.bookingItems.map(i => i.court.name).join(', ')}</div>
                                <div style={{ marginTop: '6px' }}><strong>เวลา:</strong> {editBooking.bookingItems.map(i => `${i.startTime}-${i.endTime}`).join(', ')}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>สถานะ</label>
                                    <select className="admin-input" value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ width: '100%' }}>
                                        <option value="PENDING">🟡 รอชำระเงิน</option>
                                        <option value="CONFIRMED">✅ ยืนยันแล้ว</option>
                                        <option value="CANCELLED">❌ ยกเลิก</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>ยอดรวม (฿)</label>
                                    <input className="admin-input" type="number" value={editAmount} onChange={e => setEditAmount(Number(e.target.value))} style={{ width: '100%' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button onClick={() => setEditBooking(null)} className="btn-admin-outline" style={{ padding: '8px 16px' }}>ยกเลิก</button>
                                <button disabled={saving} onClick={async () => {
                                    setSaving(true)
                                    try {
                                        const res = await fetch('/api/bookings', {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ bookingId: editBooking.id, status: editStatus, totalAmount: editAmount }),
                                        })
                                        if (res.ok) {
                                            toast.success('บันทึกสำเร็จ')
                                            setEditBooking(null)
                                            if (selectedCustomer) viewCustomerHistory(selectedCustomer)
                                        } else toast.error('บันทึกไม่สำเร็จ')
                                    } catch { toast.error('เกิดข้อผิดพลาด') }
                                    finally { setSaving(false) }
                                }} className="btn-admin" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Save size={14} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div >
        )
    }

    // ── Customer List View ──
    return (
        <FadeIn><div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>ลูกค้า ({filtered.length})</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>กดชื่อลูกค้าเพื่อดูประวัติการจอง</p>
                </div>
                <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--a-text-muted)' }} />
                    <input className="admin-input" style={{ paddingLeft: '36px', width: '280px' }} placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="admin-card">
                <table className="admin-table">
                    <thead>
                        <tr><th>ลูกค้า</th><th>เบอร์โทร</th><th>จำนวนการจอง</th><th>สถานะ</th></tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)', margin: '0 auto' }} /></td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>ไม่พบข้อมูลลูกค้า</td></tr>
                        ) : filtered.map(c => (
                            <tr key={c.id} onClick={() => viewCustomerHistory(c)} style={{ cursor: 'pointer' }}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {c.lineAvatar ? (
                                            <img src={c.lineAvatar} alt="" style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--a-primary-light)', color: 'var(--a-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                                                {c.name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                        )}
                                        <div>
                                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {c.name}
                                                {c.lineUserId && <span style={{ fontSize: '10px', background: '#06c755', color: 'white', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>LINE</span>}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>
                                                {c.email && !c.email.endsWith('@line.local') && <span>{c.email}</span>}
                                                {c.lineUserId && c.lineDisplayName && <span style={{ color: '#06c755' }}>{c.email && !c.email.endsWith('@line.local') ? ' · ' : ''}LINE: {c.lineDisplayName}</span>}
                                                {!c.email && !c.lineUserId && '-'}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    {c.phone && !c.phone.startsWith('LINE-') ? c.phone : c.lineUserId ? (
                                        <span style={{ color: '#06c755', fontSize: '13px' }}>{c.lineDisplayName || 'LINE User'}</span>
                                    ) : '-'}
                                </td>
                                <td><span style={{ fontWeight: 700, color: 'var(--a-primary)' }}>{c.bookingCount}</span> ครั้ง</td>
                                <td><span className="badge badge-success">Active</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div></FadeIn>
    )
}
