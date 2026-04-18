'use client'

import { FadeIn } from '@/components/Motion'

import { useState, useEffect } from 'react'
import { Search, Phone, Mail, Calendar, ChevronLeft, Clock, MapPin, X, Edit2, Save, CreditCard, Image as ImageIcon, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Customer {
    id: string; name: string; email: string; phone: string; role: string; isActive: boolean
    createdAt: string; bookingCount: number; lineAvatar?: string; lineUserId?: string; lineDisplayName?: string
}

interface BookingDetail {
    id: string; bookingNumber: string; status: string; totalAmount: number; createdAt: string
    createdByAdmin?: boolean
    user?: { id: string; name: string; email: string; phone: string; lineUserId?: string | null; lineDisplayName?: string | null }
    bookingItems: Array<{ date: string; startTime: string; endTime: string; price: number; court: { name: string; venue?: { name: string } | null }; teacher?: { name: string } | null }>
    participants: Array<{ name: string; sportType: string; phone?: string | null }>
    payments: Array<{ id: string; method: string; status: string; amount: number; createdAt: string; slipUrl?: string | null }>
}

type BookingApiItem = BookingDetail & { user?: Customer }
type CustomerApiItem = Omit<Customer, 'bookingCount'> & { bookingCount?: number; _count?: { bookings: number } }

const emptyCustomerForm = { name: '', phone: '', email: '', lineUserId: '' }

const detailStatusMap: Record<string, { label: string; bg: string; color: string }> = {
    PENDING: { label: 'รอชำระ', bg: '#fff8e1', color: '#f5a623' },
    CONFIRMED: { label: 'ยืนยัน', bg: '#e8f5e9', color: '#27ae60' },
    CANCELLED: { label: 'ยกเลิก', bg: '#fde8e8', color: '#e74c3c' },
}

const paymentStatusMap: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'รอตรวจสอบ', color: '#f5a623' },
    VERIFIED: { label: 'ตรวจสอบแล้ว', color: '#27ae60' },
    REJECTED: { label: 'ถูกปฏิเสธ', color: '#e74c3c' },
}

const paymentMethodMap: Record<string, string> = {
    PROMPTPAY: 'PromptPay',
    QR_PROMPTPAY: 'QR PromptPay',
    BANK_TRANSFER: 'โอนเงิน',
    CASH: 'เงินสด',
    PACKAGE: 'แพ็กเกจ',
    CREDIT_CARD: 'บัตรเครดิต',
}

function formatBookingDateTH(dateStr: string, options?: Intl.DateTimeFormatOptions) {
    return new Date(dateStr).toLocaleDateString('th-TH', options ?? { day: 'numeric', month: 'short' })
}

function getBookingDateGroups(items: BookingDetail['bookingItems']) {
    return Object.entries(
        items.reduce<Record<string, BookingDetail['bookingItems']>>((groups, item) => {
            if (!groups[item.date]) groups[item.date] = []
            groups[item.date].push(item)
            return groups
        }, {})
    )
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, dateItems]) => ({
            date,
            formattedDate: formatBookingDateTH(date),
            times: [...dateItems]
                .sort((a, b) => {
                    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime)
                    if (a.endTime !== b.endTime) return a.endTime.localeCompare(b.endTime)
                    return a.court.name.localeCompare(b.court.name)
                })
                .map(item => `${item.startTime}-${item.endTime}`),
        }))
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [editCustomerMode, setEditCustomerMode] = useState(false)
    const [customerForm, setCustomerForm] = useState(emptyCustomerForm)
    const [bookings, setBookings] = useState<BookingDetail[]>([])
    const [loadingBookings, setLoadingBookings] = useState(false)
    const [editBooking, setEditBooking] = useState<BookingDetail | null>(null)
    const [editStatus, setEditStatus] = useState('')
    const [editAmount, setEditAmount] = useState(0)
    const [saving, setSaving] = useState(false)
    const [savingCustomer, setSavingCustomer] = useState(false)
    const [viewSlip, setViewSlip] = useState<string | null>(null)

    const normalizeCustomer = (customer: CustomerApiItem): Customer => ({
        ...customer,
        bookingCount: customer.bookingCount ?? customer._count?.bookings ?? 0,
    })

    const fetchCustomers = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/customers?take=1000', { cache: 'no-store' })
            const data = await res.json() as { customers?: CustomerApiItem[] }
            setCustomers((data.customers || []).map(normalizeCustomer))
        } catch {
            toast.error('โหลดข้อมูลไม่สำเร็จ')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchCustomers() }, [])

    const filtered = customers.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search) ||
        c.lineUserId?.toLowerCase().includes(search.toLowerCase()) ||
        c.lineDisplayName?.toLowerCase().includes(search.toLowerCase())
    )

    const viewCustomerHistory = async (customer: Customer) => {
        setSelectedCustomer(customer)
        setEditCustomerMode(false)
        setCustomerForm({
            name: customer.name || '',
            phone: customer.phone || '',
            email: customer.email || '',
            lineUserId: customer.lineUserId || '',
        })
        setLoadingBookings(true)
        try {
            const res = await fetch(`/api/bookings?search=${encodeURIComponent(customer.name)}`, { cache: 'no-store' })
            const data = await res.json() as { bookings?: BookingApiItem[] }
            // Filter to only this customer's bookings
            const customerBookings = (data.bookings || []).filter((b) => b.user?.id === customer.id)
            setBookings(customerBookings)
        } catch { toast.error('โหลดประวัติไม่สำเร็จ') }
        finally { setLoadingBookings(false) }
    }

    const handleSaveCustomer = async () => {
        if (!selectedCustomer) return
        if (!customerForm.name.trim() || !customerForm.phone.trim() || !customerForm.email.trim()) {
            toast.error('กรุณากรอกชื่อ เบอร์โทร และอีเมล')
            return
        }

        setSavingCustomer(true)
        try {
            const res = await fetch('/api/customers', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedCustomer.id,
                    name: customerForm.name,
                    phone: customerForm.phone,
                    email: customerForm.email,
                    lineUserId: customerForm.lineUserId,
                }),
            })
            const data = await res.json() as { customer?: CustomerApiItem; error?: string }
            if (!res.ok || !data.customer) {
                toast.error(data.error || 'บันทึกข้อมูลลูกค้าไม่สำเร็จ')
                return
            }

            const updatedCustomer = normalizeCustomer(data.customer)
            setSelectedCustomer(updatedCustomer)
            setCustomers(prev => prev.map(customer => customer.id === updatedCustomer.id ? updatedCustomer : customer))
            setBookings(prev => prev.map(booking => booking.user?.id === updatedCustomer.id
                ? { ...booking, user: { ...booking.user, ...updatedCustomer } }
                : booking
            ))
            setEditCustomerMode(false)
            toast.success('บันทึกข้อมูลลูกค้าสำเร็จ')
        } catch {
            toast.error('เกิดข้อผิดพลาด')
        } finally {
            setSavingCustomer(false)
        }
    }

    const statusBadge = (status: string) => {
        switch (status) {
            case 'CONFIRMED': return { label: 'ยืนยันแล้ว', cls: 'badge-success' }
            case 'CANCELLED': return { label: 'ยกเลิก', cls: 'badge-danger' }
            default: return { label: 'รอดำเนินการ', cls: 'badge-warning' }
        }
    }

    const handleSaveEdit = async () => {
        if (!editBooking) return
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
                if (selectedCustomer) await viewCustomerHistory(selectedCustomer)
            } else {
                toast.error('บันทึกไม่สำเร็จ')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาด')
        } finally {
            setSaving(false)
        }
    }

    const handleCancelBooking = async (bookingId: string) => {
        const reason = prompt('ระบุเหตุผลในการยกเลิก:')
        if (reason === null) return
        try {
            const res = await fetch('/api/bookings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId, action: 'cancel', reason }),
            })
            if (res.ok) {
                toast.success('ยกเลิกการจองสำเร็จ')
                setEditBooking(null)
                if (selectedCustomer) await viewCustomerHistory(selectedCustomer)
            } else {
                toast.error('ยกเลิกไม่สำเร็จ')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาด')
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
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
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
                        <button
                            type="button"
                            onClick={() => {
                                setCustomerForm({
                                    name: selectedCustomer.name || '',
                                    phone: selectedCustomer.phone || '',
                                    email: selectedCustomer.email || '',
                                    lineUserId: selectedCustomer.lineUserId || '',
                                })
                                setEditCustomerMode(true)
                            }}
                            className="btn-admin-outline"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}
                        >
                            <Edit2 size={14} /> แก้ไขข้อมูลลูกค้า
                        </button>
                    </div>
                    {editCustomerMode && (
                        <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '1px solid var(--a-border)' }}>
                            <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '12px' }}>ข้อมูลลูกค้า</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                <div className="input-group">
                                    <label style={{ color: 'var(--a-text-secondary)' }}>ชื่อ</label>
                                    <input className="admin-input" value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} />
                                </div>
                                <div className="input-group">
                                    <label style={{ color: 'var(--a-text-secondary)' }}>เบอร์โทรศัพท์</label>
                                    <input className="admin-input" value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} />
                                </div>
                                <div className="input-group">
                                    <label style={{ color: 'var(--a-text-secondary)' }}>อีเมล</label>
                                    <input className="admin-input" type="email" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} />
                                </div>
                                <div className="input-group">
                                    <label style={{ color: 'var(--a-text-secondary)' }}>LINE User ID สำหรับแจ้งเตือน</label>
                                    <input className="admin-input" value={customerForm.lineUserId} onChange={e => setCustomerForm({ ...customerForm, lineUserId: e.target.value })} placeholder="เช่น Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                                    <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginTop: '4px' }}>ไม่ใช่ LINE ID ทั่วไป ต้องเป็นรหัสที่ได้จาก LINE Login เท่านั้น</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                                <button type="button" onClick={() => setEditCustomerMode(false)} className="btn-admin-outline">ยกเลิก</button>
                                <button type="button" disabled={savingCustomer} onClick={handleSaveCustomer} className="btn-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Save size={14} /> {savingCustomer ? 'กำลังบันทึก...' : 'บันทึกข้อมูลลูกค้า'}
                                </button>
                            </div>
                        </div>
                    )}
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
                                const bookingDateGroups = getBookingDateGroups(b.bookingItems)
                                return (
                                    <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => { setEditBooking(b); setEditStatus(b.status); setEditAmount(b.totalAmount) }}>
                                        <td style={{ fontWeight: 600, fontFamily: "'Inter'" }}>{b.bookingNumber}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {bookingDateGroups.map(group => (
                                                    <div key={group.date}>{group.formattedDate}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td>{b.bookingItems.map(i => i.court.name).join(', ')}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {bookingDateGroups.map(group => (
                                                    <div key={group.date}>{group.times.join(', ')}</div>
                                                ))}
                                            </div>
                                        </td>
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
                        <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '780px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
                                <div>
                                    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>รายละเอียดการจอง</h2>
                                    <span style={{ fontSize: '14px', fontFamily: "'Inter', sans-serif", color: 'var(--a-text-muted)' }}>{editBooking.bookingNumber}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{
                                        padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                                        background: detailStatusMap[editStatus]?.bg || '#f3f4f6',
                                        color: detailStatusMap[editStatus]?.color || '#6b7280',
                                    }}>{detailStatusMap[editStatus]?.label || editStatus}</span>
                                    {editBooking.createdByAdmin ? (
                                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#fce4ec', color: '#c62828', fontWeight: 600 }}>Admin</span>
                                    ) : (
                                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#e3f2fd', color: '#1976d2', fontWeight: 600 }}>เว็บ</span>
                                    )}
                                    <button onClick={() => setEditBooking(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                                </div>
                            </div>

                            <div style={{ background: '#f8f9fa', padding: '14px', borderRadius: '10px', marginBottom: '16px', fontSize: '14px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div><strong>ลูกค้า:</strong> {editBooking.user?.name || selectedCustomer.name}</div>
                                    <div><strong>โทร:</strong> {editBooking.user?.phone || selectedCustomer.phone || '-'}</div>
                                    <div><strong>อีเมล:</strong> {editBooking.user?.email || selectedCustomer.email || '-'}</div>
                                    <div><strong>วันที่สร้าง:</strong> {new Date(editBooking.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                    <div style={{ gridColumn: '1 / -1' }}><strong>วันที่จอง:</strong> {getBookingDateGroups(editBooking.bookingItems).map(group => group.formattedDate).join(', ')}</div>
                                    <div style={{ flex: 1, minWidth: '140px' }}>
                                        <strong style={{ fontSize: '13px' }}>สถานะ:</strong>
                                        <select className="admin-input" value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ marginTop: '4px', padding: '6px 10px' }}>
                                            <option value="PENDING">🟡 รอชำระเงิน</option>
                                            <option value="CONFIRMED">✅ ชำระเงินแล้ว</option>
                                            <option value="CANCELLED">❌ ยกเลิก</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: 1, minWidth: '140px' }}>
                                        <strong style={{ fontSize: '13px' }}>ยอดรวม (฿):</strong>
                                        <input className="admin-input" type="number" value={editAmount} onChange={e => setEditAmount(Number(e.target.value))} style={{ marginTop: '4px', padding: '6px 10px' }} />
                                    </div>
                                </div>
                            </div>

                            <h3 style={{ fontWeight: 700, marginBottom: '8px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <MapPin size={16} style={{ color: 'var(--a-primary)' }} /> รายละเอียดการจอง
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                                {editBooking.bookingItems.map((item, i) => (
                                    <div key={i} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--a-border)', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{item.court.name}</div>
                                            {item.court.venue && <div style={{ fontSize: '11px', color: 'var(--a-primary)', fontWeight: 600 }}>📍 {item.court.venue.name}</div>}
                                            <div style={{ fontSize: '13px', color: 'var(--a-text-secondary)' }}>
                                                {formatBookingDateTH(item.date)} | {item.startTime} - {item.endTime}
                                            </div>
                                            {item.teacher && <div style={{ fontSize: '12px', color: 'var(--a-primary)', marginTop: '2px' }}>ครู: {item.teacher.name}</div>}
                                        </div>
                                        <div style={{ fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>฿{item.price.toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>

                            {editBooking.participants.length > 0 && (
                                <>
                                    <h3 style={{ fontWeight: 700, marginBottom: '8px', fontSize: '15px' }}>ผู้เรียน</h3>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                        {editBooking.participants.map((participant, i) => (
                                            <span key={i} style={{ padding: '6px 12px', borderRadius: '6px', background: '#f3f4f6', fontSize: '13px' }}>
                                                <strong>{participant.name}</strong> - {participant.sportType || '-'} {participant.phone ? `| ${participant.phone}` : ''}
                                            </span>
                                        ))}
                                    </div>
                                </>
                            )}

                            <h3 style={{ fontWeight: 700, marginBottom: '8px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CreditCard size={16} style={{ color: 'var(--a-primary)' }} /> การชำระเงิน
                            </h3>
                            {editBooking.payments.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', borderRadius: '8px', border: '1px solid var(--a-border)', color: 'var(--a-text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                                    ยังไม่มีการชำระเงิน
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                    {editBooking.payments.map(payment => (
                                        <div key={payment.id} style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--a-border)', fontSize: '14px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                                <div>
                                                    <span style={{ fontWeight: 600 }}>{paymentMethodMap[payment.method] || payment.method}</span>
                                                    <span style={{ fontSize: '12px', color: 'var(--a-text-muted)', marginLeft: '8px' }}>
                                                        {new Date(payment.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>฿{payment.amount.toLocaleString()}</span>
                                                    <span style={{ fontSize: '12px', fontWeight: 600, color: paymentStatusMap[payment.status]?.color || '#999' }}>
                                                        {paymentStatusMap[payment.status]?.label || payment.status}
                                                    </span>
                                                </div>
                                            </div>
                                            {payment.slipUrl && (
                                                <div style={{ marginTop: '10px' }}>
                                                    <button onClick={(e) => { e.stopPropagation(); setViewSlip(payment.slipUrl || null) }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--a-primary)', background: 'var(--a-primary-light)', color: 'var(--a-primary)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                                        <ImageIcon size={14} /> ดูสลิป
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ padding: '12px 16px', background: '#fef9e7', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700 }}>
                                <span>ยอดรวม</span>
                                <span style={{ fontFamily: "'Inter', sans-serif", color: 'var(--a-primary)' }}>฿{editAmount.toLocaleString()}</span>
                            </div>

                            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                                {editStatus !== 'CANCELLED' && (
                                    <button onClick={() => handleCancelBooking(editBooking.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e17055', background: 'white', color: '#e17055', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                        <XCircle size={16} /> ยกเลิกการจอง
                                    </button>
                                )}
                                {editStatus === 'PENDING' && (
                                    <button onClick={() => setEditStatus('CONFIRMED')} className="btn-admin"
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 16px', fontSize: '14px' }}>
                                        <CheckCircle size={16} /> ตั้งเป็นยืนยัน
                                    </button>
                                )}
                                <button onClick={() => setEditBooking(null)} className="btn-admin-outline" style={{ padding: '8px 16px' }}>ปิด</button>
                                <button disabled={saving} onClick={handleSaveEdit} className="btn-admin" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Save size={14} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {viewSlip && (
                    <div className="modal-overlay" style={{ zIndex: 200 }} onClick={() => setViewSlip(null)}>
                        <div onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%', background: 'white', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontWeight: 700, fontSize: '16px' }}>สลิปการชำระเงิน</h3>
                                <button onClick={() => setViewSlip(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                            </div>
                            <img src={viewSlip} alt="Payment slip" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px', border: '1px solid var(--a-border)' }} />
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
