'use client'

import { FadeIn } from '@/components/Motion'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Calendar, Eye, X, MapPin, Clock, CreditCard, Image, ChevronLeft, ChevronRight, ClipboardList, CheckCircle, XCircle, Edit2, Save, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface Booking {
    id: string; bookingNumber: string; status: string; totalAmount: number
    createdAt: string; createdByAdmin: boolean; isBookerLearner: boolean; notes: string | null
    user: { id: string; name: string; email: string; phone: string }
    bookingItems: Array<{ id?: string; court: { name: string; venue?: { name: string } | null }; courtId: string; date: string; startTime: string; endTime: string; price: number; teacher?: { name: string }; originalCourtId?: string | null; originalCourt?: { name: string } | null; originalDate?: string | null; originalStartTime?: string | null; originalEndTime?: string | null }>
    participants: Array<{ name: string; sportType: string; phone: string; height?: number | null; weight?: number | null; shoeSize?: string | null }>
    payments: Array<{ id: string; method: string; status: string; amount: number; slipUrl: string | null; createdAt: string; verifiedAt: string | null }>
}

const statusMap: Record<string, { label: string; bg: string; color: string }> = {
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
    PROMPTPAY: '📱 PromptPay',
    QR_PROMPTPAY: '📱 QR PromptPay',
    BANK_TRANSFER: '🏦 โอนเงิน',
    CASH: '💵 เงินสด',
    PACKAGE: '📦 แพ็คเกจ',
    CREDIT_CARD: '💳 บัตรเครดิต',
}

export default function BookingsManagement() {
    const router = useRouter()
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [sourceFilter, setSourceFilter] = useState<string>('')
    const [viewBooking, setViewBooking] = useState<Booking | null>(null)
    const [viewSlip, setViewSlip] = useState<string | null>(null)
    const [editMode, setEditMode] = useState(false)
    const [editStatus, setEditStatus] = useState('')
    const [editAmount, setEditAmount] = useState(0)
    const [editBookingItems, setEditBookingItems] = useState<Booking['bookingItems']>([])
    const [saving, setSaving] = useState(false)
    const [page, setPage] = useState(0)
    const pageSize = 20
    const editDateRefs = useRef<(HTMLInputElement | null)[]>([])

    const formatDateDD = (dateStr: string) => {
        if (!dateStr) return ''
        const [y, m, d] = dateStr.split('-')
        return `${d}/${m}/${y}`
    }

    const formatShortDateTH = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    }

    const fetchBookings = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (statusFilter) params.set('status', statusFilter)
            const res = await fetch(`/api/bookings?take=500&${params.toString()}`, { cache: 'no-store' })
            const data = await res.json()
            let list: Booking[] = data.bookings || []
            if (sourceFilter === 'admin') list = list.filter(b => b.createdByAdmin)
            if (sourceFilter === 'web') list = list.filter(b => !b.createdByAdmin)
            setBookings(list)
            setPage(0)
        } catch { toast.error('โหลดข้อมูลไม่สำเร็จ') }
        finally { setLoading(false) }
    }, [search, statusFilter, sourceFilter])

    useEffect(() => {
        const t = setTimeout(fetchBookings, 300)
        return () => clearTimeout(t)
    }, [fetchBookings])

    const handleConfirm = async (bookingId: string) => {
        try {
            const res = await fetch('/api/bookings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId, status: 'CONFIRMED' }),
            })
            if (res.ok) {
                toast.success('ยืนยันการจองสำเร็จ')
                setViewBooking(null)
                fetchBookings()
            } else { toast.error('ไม่สามารถยืนยันได้') }
        } catch { toast.error('เกิดข้อผิดพลาด') }
    }

    const handleSaveEdit = async () => {
        if (!viewBooking) return
        setSaving(true)
        try {
            const res = await fetch('/api/bookings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId: viewBooking.id,
                    status: editStatus,
                    totalAmount: editAmount,
                    bookingItems: editBookingItems.map(item => ({
                        id: item.id,
                        courtId: item.courtId,
                        date: item.date,
                        startTime: item.startTime,
                        endTime: item.endTime,
                        price: item.price,
                    })),
                }),
            })
            if (res.ok) {
                toast.success('บันทึกการแก้ไขสำเร็จ')
                setEditMode(false)
                setViewBooking(null)
                fetchBookings()
            } else { toast.error('บันทึกไม่สำเร็จ') }
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setSaving(false) }
    }

    const handleCancel = async (bookingId: string) => {
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
                setViewBooking(null)
                fetchBookings()
            } else { toast.error('ไม่สามารถยกเลิกได้') }
        } catch { toast.error('เกิดข้อผิดพลาด') }
    }

    const paged = bookings.slice(page * pageSize, (page + 1) * pageSize)
    const totalPages = Math.ceil(bookings.length / pageSize)

    const toDateOnly = (dateStr: string) => {
        const d = new Date(dateStr)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const sortBookingItems = <T extends { date: string; startTime: string }>(items: T[]) => {
        return [...items].sort((a, b) => {
            const dateCompare = toDateOnly(a.date).localeCompare(toDateOnly(b.date))
            if (dateCompare !== 0) return dateCompare
            return a.startTime.localeCompare(b.startTime)
        })
    }

    const updateEditBookingItem = (index: number, patch: Partial<Booking['bookingItems'][number]>) => {
        setEditBookingItems(prev => {
            const next = [...prev]
            next[index] = { ...next[index], ...patch }
            return sortBookingItems(next)
        })
    }

    const removeEditBookingItem = (index: number) => {
        if (editBookingItems.length <= 1) {
            toast.error('ต้องมีรายการจองอย่างน้อย 1 รายการ')
            return
        }

        const nextItems = editBookingItems.filter((_, itemIndex) => itemIndex !== index)
        setEditBookingItems(nextItems)
        setEditAmount(nextItems.reduce((sum, item) => sum + (item.price || 0), 0))
    }

    const totalConfirmed = bookings.filter(b => b.status === 'CONFIRMED').length
    const totalPending = bookings.filter(b => b.status === 'PENDING').length
    const totalRevenue = bookings.filter(b => b.status !== 'CANCELLED').reduce((sum, b) => sum + b.totalAmount, 0)
    const fromAdmin = bookings.filter(b => b.createdByAdmin).length
    const fromWeb = bookings.filter(b => !b.createdByAdmin).length

    return (
        <FadeIn><div>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>รายการจองทั้งหมด</h2>
                <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>ข้อมูลการจองจากหน้าเว็บและ Admin รวมถึงสลิปการชำระเงิน</p>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div className="admin-card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '24px', color: 'var(--a-text)', fontFamily: "'Inter', sans-serif" }}>{bookings.length}</div>
                    <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>ทั้งหมด</div>
                </div>
                <div className="admin-card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '24px', color: '#27ae60', fontFamily: "'Inter', sans-serif" }}>{totalConfirmed}</div>
                    <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>ยืนยันแล้ว</div>
                </div>
                <div className="admin-card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '24px', color: '#f5a623', fontFamily: "'Inter', sans-serif" }}>{totalPending}</div>
                    <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>รอชำระ</div>
                </div>
                <div className="admin-card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '24px', color: 'var(--a-primary)', fontFamily: "'Inter', sans-serif" }}>฿{totalRevenue.toLocaleString()}</div>
                    <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>รายได้รวม</div>
                </div>
            </div>

            {/* Filters */}
            <div className="admin-card" style={{ padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--a-text-muted)' }} />
                        <input className="admin-input" style={{ paddingLeft: '36px' }} placeholder="ค้นหาชื่อ / เบอร์โทร / เลขจอง" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="admin-input" style={{ width: '160px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="">สถานะทั้งหมด</option>
                        <option value="PENDING">🟡 รอชำระเงิน</option>
                        <option value="CONFIRMED">🟢 ยืนยัน</option>
                        <option value="CANCELLED">🔴 ยกเลิก</option>
                    </select>
                    <select className="admin-input" style={{ width: '160px' }} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
                        <option value="">ช่องทางทั้งหมด</option>
                        <option value="web">🌐 จากเว็บไซต์</option>
                        <option value="admin">👤 จาก Admin</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', fontSize: '12px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#e3f2fd', color: '#1976d2', fontWeight: 600 }}>🌐 เว็บ: {fromWeb}</span>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#fce4ec', color: '#c62828', fontWeight: 600 }}>👤 Admin: {fromAdmin}</span>
                </div>
            </div>

            {/* Bookings Table */}
            <div className="admin-card" style={{ overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)', margin: '0 auto' }} /></div>
                ) : bookings.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--a-text-muted)' }}>
                        <ClipboardList size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                        <p>ไม่พบรายการจอง</p>
                    </div>
                ) : (
                    <>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>เลขจอง</th>
                                        <th>ลูกค้า</th>
                                        <th>วันที่จอง</th>
                                        <th>สนาม / เวลา</th>
                                        <th>ยอดเงิน</th>
                                        <th>การชำระ</th>
                                        <th>สถานะ</th>
                                        <th>ช่องทาง</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paged.map(b => {
                                        const sortedItems = sortBookingItems(b.bookingItems)
                                        const firstItem = sortedItems[0]
                                        const hasSlip = b.payments.some(p => p.slipUrl)
                                        return (
                                            <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setViewBooking(b)}>
                                                <td style={{ fontWeight: 700, fontSize: '13px', fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' }}>
                                                    {b.bookingNumber}
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{b.user?.name || '-'}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>{b.user?.phone || ''}</div>
                                                </td>
                                                <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                    {firstItem ? new Date(firstItem.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '-'}
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '13px' }}>{firstItem?.court?.name || '-'}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>
                                                        {firstItem ? `${firstItem.startTime}-${firstItem.endTime}` : '-'}
                                                        {sortedItems.length > 1 && <span style={{ color: 'var(--a-primary)', fontWeight: 600 }}> +{sortedItems.length - 1}</span>}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
                                                    ฿{b.totalAmount.toLocaleString()}
                                                </td>
                                                <td>
                                                    {b.payments.length > 0 ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: 600, color: paymentStatusMap[b.payments[0].status]?.color || '#999' }}>
                                                                {paymentStatusMap[b.payments[0].status]?.label || b.payments[0].status}
                                                            </span>
                                                            {hasSlip && <Image size={14} style={{ color: 'var(--a-primary)' }} />}
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span style={{
                                                        padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                                        background: statusMap[b.status]?.bg || '#f3f4f6', color: statusMap[b.status]?.color || '#666',
                                                    }}>
                                                        {statusMap[b.status]?.label || b.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    {b.createdByAdmin ? (
                                                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#fce4ec', color: '#c62828', fontWeight: 600 }}>👤 Admin</span>
                                                    ) : (
                                                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#e3f2fd', color: '#1976d2', fontWeight: 600 }}>🌐 เว็บ</span>
                                                    )}
                                                </td>
                                                <td><Eye size={16} style={{ color: 'var(--a-text-muted)' }} /></td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '16px', borderTop: '1px solid var(--a-border)' }}>
                                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-admin-outline" style={{ padding: '6px 12px' }}>
                                    <ChevronLeft size={16} />
                                </button>
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>หน้า {page + 1} / {totalPages}</span>
                                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-admin-outline" style={{ padding: '6px 12px' }}>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Booking Detail Modal */}
            {viewBooking && (
                <div className="modal-overlay" onClick={() => setViewBooking(null)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>รายละเอียดการจอง</h2>
                                <span style={{ fontSize: '14px', fontFamily: "'Inter', sans-serif", color: 'var(--a-text-muted)' }}>{viewBooking.bookingNumber}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                    padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                                    background: statusMap[viewBooking.status]?.bg, color: statusMap[viewBooking.status]?.color,
                                }}>{statusMap[viewBooking.status]?.label}</span>
                                {viewBooking.createdByAdmin ? (
                                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#fce4ec', color: '#c62828', fontWeight: 600 }}>👤 Admin</span>
                                ) : (
                                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#e3f2fd', color: '#1976d2', fontWeight: 600 }}>🌐 เว็บ</span>
                                )}
                                {editMode ? (
                                    <>
                                        <button onClick={handleSaveEdit} disabled={saving}
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #27ae60', background: '#e8f5e9', color: '#27ae60', fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                            <Save size={12} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                                        </button>
                                        <button onClick={() => setEditMode(false)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--a-border)', background: 'white', color: 'var(--a-text-muted)', fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                            ยกเลิก
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={() => {
                                        setEditMode(true)
                                        setEditStatus(viewBooking.status)
                                        setEditAmount(viewBooking.totalAmount)
                                        setEditBookingItems(sortBookingItems(viewBooking.bookingItems).map(item => ({
                                            ...item,
                                            date: toDateOnly(item.date),
                                        })))
                                    }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--a-primary)', background: 'var(--a-primary-light)', color: 'var(--a-primary)', fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                        <Edit2 size={12} /> แก้ไข
                                    </button>
                                )}
                                <button onClick={() => setViewBooking(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div style={{ background: '#f8f9fa', padding: '14px', borderRadius: '10px', marginBottom: '16px', fontSize: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div><strong>ลูกค้า:</strong> {viewBooking.user?.name}</div>
                                <div><strong>โทร:</strong> {viewBooking.user?.phone || '-'}</div>
                                <div><strong>อีเมล:</strong> {viewBooking.user?.email || '-'}</div>
                                <div><strong>วันที่สร้าง:</strong> {new Date(viewBooking.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                {editMode && (
                                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
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
                                )}
                            </div>
                        </div>

                        {/* Booking Items */}
                        <h3 style={{ fontWeight: 700, marginBottom: '8px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={16} style={{ color: 'var(--a-primary)' }} /> รายการจอง ({editMode ? editBookingItems.length : viewBooking.bookingItems.length})
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                            {(editMode ? editBookingItems : sortBookingItems(viewBooking.bookingItems)).map((item, i) => (
                                <div key={i} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--a-border)', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600 }}>{item.court.name}</div>
                                        {item.court.venue && <div style={{ fontSize: '11px', color: 'var(--a-primary)', fontWeight: 600 }}>Venue: {item.court.venue.name}</div>}
                                        {editMode ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                                                <div
                                                    style={{ position: 'relative', cursor: 'pointer' }}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => editDateRefs.current[i]?.showPicker?.()}
                                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') editDateRefs.current[i]?.showPicker?.() }}
                                                >
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={formatDateDD(item.date)}
                                                        className="admin-input"
                                                        style={{ width: '160px', padding: '6px 10px', cursor: 'pointer', background: '#fff' }}
                                                    />
                                                    <input
                                                        type="date"
                                                        ref={el => { editDateRefs.current[i] = el }}
                                                        value={item.date}
                                                        onChange={e => updateEditBookingItem(i, { date: e.target.value })}
                                                        style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}
                                                    />
                                                </div>
                                                <select className="admin-input" value={item.startTime} onChange={e => updateEditBookingItem(i, { startTime: e.target.value })} style={{ padding: '6px 10px' }}>
                                                    {Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`).map(time => (
                                                        <option key={time} value={time}>{time}</option>
                                                    ))}
                                                </select>
                                                <select className="admin-input" value={item.endTime} onChange={e => updateEditBookingItem(i, { endTime: e.target.value })} style={{ padding: '6px 10px' }}>
                                                    {Array.from({ length: 24 }, (_, h) => `${String(h + 1).padStart(2, '0')}:00`).map(time => (
                                                        <option key={time} value={time}>{time}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '13px', color: 'var(--a-text-secondary)' }}>
                                                {new Date(item.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} | {item.startTime} - {item.endTime}
                                            </div>
                                        )}
                                        {editMode && (() => {
                                            const persistedItem = item.id
                                                ? viewBooking.bookingItems.find(originalItem => originalItem.id === item.id)
                                                : viewBooking.bookingItems[i]
                                            if (!persistedItem) return null

                                            const persistedDate = toDateOnly(persistedItem.date)
                                            const hasPendingChange =
                                                item.courtId !== persistedItem.courtId ||
                                                item.date !== persistedDate ||
                                                item.startTime !== persistedItem.startTime ||
                                                item.endTime !== persistedItem.endTime
                                            const hasStoredOriginal = Boolean(persistedItem.originalCourtId || persistedItem.originalDate || persistedItem.originalStartTime || persistedItem.originalEndTime)

                                            if (!hasPendingChange && !hasStoredOriginal) return null

                                            const origCourtName = hasPendingChange
                                                ? persistedItem.court.name
                                                : (persistedItem.originalCourt?.name || persistedItem.court.name)
                                            const origDate = hasPendingChange
                                                ? formatShortDateTH(persistedItem.date)
                                                : formatShortDateTH(persistedItem.originalDate || persistedItem.date)
                                            const origStart = hasPendingChange ? persistedItem.startTime : (persistedItem.originalStartTime || persistedItem.startTime)
                                            const origEnd = hasPendingChange ? persistedItem.endTime : (persistedItem.originalEndTime || persistedItem.endTime)

                                            return (
                                                <div style={{ fontSize: '11px', color: '#e17055', marginTop: '6px', padding: '4px 8px', background: '#fff5f5', borderRadius: '4px', borderLeft: '3px solid #e17055' }}>
                                                    📌 ข้อมูลเดิม: {origCourtName} | {origDate} | {origStart}-{origEnd} | ฿{persistedItem.price.toLocaleString()}
                                                </div>
                                            )
                                        })()}
                                        {item.teacher && <div style={{ fontSize: '12px', color: 'var(--a-primary)', marginTop: '2px' }}>Teacher: {item.teacher.name}</div>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                        <div style={{ fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>THB {item.price.toLocaleString()}</div>
                                        {editMode && (
                                            <button
                                                type="button"
                                                onClick={() => removeEditBookingItem(i)}
                                                aria-label="ลบรายการจอง"
                                                title="ลบรายการจอง"
                                                style={{
                                                    background: '#fde8e8',
                                                    border: '1px solid #f5c6cb',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    color: '#e17055',
                                                    padding: '6px 10px',
                                                    fontSize: '12px',
                                                    fontWeight: 800,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    fontFamily: 'inherit',
                                                }}
                                            >
                                                <Trash2 size={14} /> ลบ
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Participants */}
                        {viewBooking.participants.length > 0 && (
                            <>
                                <h3 style={{ fontWeight: 700, marginBottom: '8px', fontSize: '15px' }}>👥 ผู้เรียน ({viewBooking.participants.length})</h3>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                    {viewBooking.participants.map((p, i) => (
                                        <div key={i} style={{ padding: '8px 14px', borderRadius: '10px', background: '#f3f4f6', fontSize: '13px', width: '100%', marginBottom: '4px' }}>
                                            <strong>{p.name}</strong> — {p.sportType}
                                            <div style={{ display: 'flex', gap: '8px', color: 'var(--a-text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                                                {p.height && <span>📏 {p.height} ซม.</span>}
                                                {p.weight && <span>⚖️ {p.weight} กก.</span>}
                                                {p.shoeSize && <span>👟 Size: {p.shoeSize}</span>}
                                                {p.phone && <span>📞 {p.phone}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Payments */}
                        <h3 style={{ fontWeight: 700, marginBottom: '8px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CreditCard size={16} style={{ color: 'var(--a-primary)' }} /> การชำระเงิน
                        </h3>
                        {viewBooking.payments.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', borderRadius: '8px', border: '1px solid var(--a-border)', color: 'var(--a-text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                                ยังไม่มีการชำระเงิน
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                {viewBooking.payments.map((pay) => (
                                    <div key={pay.id} style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--a-border)', fontSize: '14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                            <div>
                                                <span style={{ fontWeight: 600 }}>{paymentMethodMap[pay.method] || pay.method}</span>
                                                <span style={{ fontSize: '12px', color: 'var(--a-text-muted)', marginLeft: '8px' }}>
                                                    {new Date(pay.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>฿{pay.amount.toLocaleString()}</span>
                                                <span style={{ fontSize: '12px', fontWeight: 600, color: paymentStatusMap[pay.status]?.color || '#999' }}>
                                                    {paymentStatusMap[pay.status]?.label || pay.status}
                                                </span>
                                            </div>
                                        </div>
                                        {pay.slipUrl && (
                                            <div style={{ marginTop: '10px' }}>
                                                <button onClick={(e) => { e.stopPropagation(); setViewSlip(pay.slipUrl) }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--a-primary)', background: 'var(--a-primary-light)', color: 'var(--a-primary)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                                    <Image size={14} /> ดูสลิป
                                                </button>
                                                {/* Slip preview thumbnail */}
                                                <img src={pay.slipUrl} alt="slip" style={{ marginTop: '8px', maxWidth: '180px', maxHeight: '120px', borderRadius: '8px', border: '1px solid var(--a-border)', cursor: 'pointer', objectFit: 'cover' }}
                                                    onClick={(e) => { e.stopPropagation(); setViewSlip(pay.slipUrl) }} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Total */}
                        <div style={{ padding: '12px 16px', background: '#fef9e7', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700 }}>
                            <span>ยอดรวม</span>
                            <span style={{ fontFamily: "'Inter', sans-serif", color: 'var(--a-primary)' }}>฿{viewBooking.totalAmount.toLocaleString()}</span>
                        </div>

                        {/* Actions */}
                        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                            {viewBooking.status !== 'CANCELLED' && (() => {
                                // Web bookings with verified payment cannot be cancelled
                                const hasVerifiedPayment = viewBooking.payments.some(p => p.status === 'VERIFIED')
                                const canCancel = viewBooking.createdByAdmin || !hasVerifiedPayment
                                if (!canCancel) return (
                                    <span style={{ fontSize: '12px', color: 'var(--a-text-muted)', padding: '8px 16px' }}>
                                        🔒 ชำระเงินแล้ว ไม่สามารถยกเลิกได้
                                    </span>
                                )
                                return (
                                    <button onClick={() => handleCancel(viewBooking.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e17055', background: 'white', color: '#e17055', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                        <XCircle size={16} /> ยกเลิกการจอง
                                    </button>
                                )
                            })()}
                            {viewBooking.status === 'PENDING' && (
                                <button onClick={() => handleConfirm(viewBooking.id)} className="btn-admin"
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 16px', fontSize: '14px' }}>
                                    <CheckCircle size={16} /> ยืนยันการจอง
                                </button>
                            )}
                            <button onClick={() => setViewBooking(null)} className="btn-admin-outline" style={{ padding: '8px 16px' }}>ปิด</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Slip Viewer Modal */}
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
        </div></FadeIn>
    )
}
