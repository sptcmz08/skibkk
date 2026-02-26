'use client'

import { useState, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Eye, MapPin, X, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

interface Booking {
    id: string; bookingNumber: string; status: string; totalAmount: number; createdAt: string; isBookerLearner: boolean
    user: { name: string; email: string; phone: string }
    bookingItems: Array<{ court: { name: string }; date: string; startTime: string; endTime: string; price: number; teacher?: { name: string } }>
    participants: Array<{ name: string; sportType: string; phone: string }>
    payments: Array<{ method: string; status: string; amount: number }>
}

interface DaySummary {
    date: string
    count: number
    totalAmount: number
}

export default function CalendarPage() {
    const now = new Date()
    const [viewYear, setViewYear] = useState(now.getFullYear())
    const [viewMonth, setViewMonth] = useState(now.getMonth())
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [bookings, setBookings] = useState<Booking[]>([])
    const [daySummaries, setDaySummaries] = useState<Record<string, DaySummary>>({})
    const [loading, setLoading] = useState(false)
    const [viewBooking, setViewBooking] = useState<Booking | null>(null)
    const [editMode, setEditMode] = useState(false)
    const [editParticipants, setEditParticipants] = useState<Array<{ name: string; sportType: string; phone: string }>>([])
    const [editStatus, setEditStatus] = useState('')
    const [editAmount, setEditAmount] = useState(0)
    const [saving, setSaving] = useState(false)

    const openBookingModal = (booking: Booking) => {
        setViewBooking(booking)
        setEditMode(false)
        setEditParticipants(booking.participants.map(p => ({ ...p })))
        setEditStatus(booking.status)
        setEditAmount(booking.totalAmount)
    }

    const refetchBookings = async () => {
        if (!selectedDate) return
        const fetchRes = await fetch(`/api/bookings?date=${selectedDate}`, { cache: 'no-store' })
        const data = await fetchRes.json()
        if (data.bookings) setBookings(data.bookings)
    }

    const saveChanges = async () => {
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
                    participants: editParticipants,
                }),
            })
            if (res.ok) {
                toast.success('บันทึกการแก้ไขสำเร็จ')
                setViewBooking(null)
                await refetchBookings()
            } else { toast.error('บันทึกไม่สำเร็จ') }
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setSaving(false) }
    }

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    // Fetch monthly summary
    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const res = await fetch(`/api/bookings?month=${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`, { cache: 'no-store' })
                const data = await res.json()
                if (data.bookings) {
                    const summaries: Record<string, DaySummary> = {}
                    data.bookings.forEach((b: Booking) => {
                        if (b.status === 'CANCELLED') return
                        b.bookingItems.forEach(item => {
                            const d = item.date.split('T')[0]
                            if (!summaries[d]) summaries[d] = { date: d, count: 0, totalAmount: 0 }
                            summaries[d].count++
                            summaries[d].totalAmount += item.price
                        })
                    })
                    setDaySummaries(summaries)
                }
            } catch { /* ignore */ }
        }
        fetchSummary()
    }, [viewYear, viewMonth])

    // Fetch bookings for selected date
    useEffect(() => {
        if (!selectedDate) return
        const fetchBookings = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/bookings?date=${selectedDate}`, { cache: 'no-store' })
                const data = await res.json()
                if (data.bookings) setBookings(data.bookings)
            } catch { toast.error('โหลดข้อมูลไม่สำเร็จ') }
            finally { setLoading(false) }
        }
        fetchBookings()
    }, [selectedDate])

    const changeMonth = (delta: number) => {
        let m = viewMonth + delta
        let y = viewYear
        if (m < 0) { m = 11; y-- }
        if (m > 11) { m = 0; y++ }
        setViewMonth(m)
        setViewYear(y)
        setSelectedDate(null)
    }

    // Calendar grid
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const calDays: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) calDays.push(null)
    for (let i = 1; i <= daysInMonth; i++) calDays.push(i)

    const statusMap: Record<string, { cls: string; label: string }> = {
        PENDING: { cls: 'badge-pending', label: 'รอชำระ' },
        CONFIRMED: { cls: 'badge-success', label: 'ยืนยัน' },
        CANCELLED: { cls: 'badge-danger', label: 'ยกเลิก' },
    }

    const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
    const dayHeaders = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--a-text)' }}>ปฏิทินการจอง</h2>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>ดูภาพรวมการจองรายเดือน</p>
                </div>
            </div>

            {/* Monthly Calendar Grid */}
            <div className="admin-card" style={{ marginBottom: '24px' }}>
                <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={() => changeMonth(-1)} className="btn-admin-outline" style={{ padding: '8px' }}><ChevronLeft size={18} /></button>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--a-text)' }}>
                            {monthNames[viewMonth]}
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--a-text-muted)' }}>{viewYear + 543}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); setSelectedDate(todayStr) }} className="btn-admin" style={{ padding: '8px 16px', fontSize: '13px' }}>วันนี้</button>
                        <button onClick={() => changeMonth(1)} className="btn-admin-outline" style={{ padding: '8px' }}><ChevronRight size={18} /></button>
                    </div>
                </div>

                <div style={{ padding: '16px' }}>
                    {/* Day headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
                        {dayHeaders.map(d => (
                            <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--a-text-muted)', padding: '8px 0' }}>
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Calendar cells */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                        {calDays.map((day, idx) => {
                            if (day === null) return <div key={`empty-${idx}`} />
                            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                            const isToday = dateStr === todayStr
                            const isSelected = dateStr === selectedDate
                            const isPast = dateStr < todayStr
                            const summary = daySummaries[dateStr]
                            const hasBookings = summary && summary.count > 0

                            return (
                                <div key={dateStr}
                                    onClick={() => setSelectedDate(dateStr)}
                                    style={{
                                        padding: '8px 4px',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        minHeight: '72px',
                                        border: isSelected ? '2px solid var(--a-primary)' : isToday ? '2px solid var(--a-primary)' : '1px solid var(--a-border)',
                                        background: isSelected ? 'var(--a-primary-light)' : hasBookings ? '#e8f5e9' : isPast ? '#f9f9f7' : '#fdfcfa',
                                        opacity: isPast ? 0.6 : 1,
                                        transition: 'all 0.15s',
                                    }}>
                                    <div style={{
                                        fontWeight: isToday ? 800 : 600,
                                        fontSize: '15px',
                                        color: isToday ? 'var(--a-primary)' : 'var(--a-text)',
                                        marginBottom: '4px',
                                    }}>
                                        {day}
                                    </div>
                                    {hasBookings ? (
                                        <div>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#00b894' }}>
                                                {summary.count} จอง
                                            </div>
                                            <div style={{ fontSize: '10px', color: 'var(--a-text-muted)' }}>
                                                ฿{summary.totalAmount.toLocaleString()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}>
                                            ว่าง
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Bookings for selected date */}
            {selectedDate && (
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3 className="admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={18} style={{ color: 'var(--a-primary)' }} />
                            {new Date(selectedDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </h3>
                        <span className="badge badge-info">{bookings.filter(b => b.status !== 'CANCELLED').length} การจอง</span>
                    </div>
                    <div style={{ padding: '16px' }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)', margin: '0 auto' }} /></div>
                        ) : bookings.filter(b => b.status !== 'CANCELLED').length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>
                                <Calendar size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                                <p>ไม่มีการจองในวันนี้</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {bookings
                                    .filter(b => b.status !== 'CANCELLED')
                                    .sort((a, b) => (a.bookingItems[0]?.startTime || '').localeCompare(b.bookingItems[0]?.startTime || ''))
                                    .map(booking => (
                                        <div key={booking.id} style={{
                                            display: 'flex', alignItems: 'center', gap: '16px',
                                            padding: '12px 16px', borderRadius: '10px',
                                            background: booking.status === 'CONFIRMED' ? '#e8f5e9' : '#fff8e1',
                                            border: `1px solid ${booking.status === 'CONFIRMED' ? '#c8e6c9' : '#ffecb3'}`,
                                            cursor: 'pointer', transition: 'all 0.2s',
                                        }} onClick={() => openBookingModal(booking)}>
                                            <div style={{ minWidth: '70px' }}>
                                                <div style={{ fontWeight: 800, fontSize: '16px', fontFamily: "'Inter'", color: 'var(--a-text)' }}>
                                                    {booking.bookingItems[0]?.startTime || '--:--'}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>
                                                    {booking.bookingItems[0]?.endTime || '--:--'}
                                                </div>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--a-text)' }}>
                                                    {booking.user?.name}
                                                    {booking.bookingItems[0]?.teacher && (
                                                        <span style={{ fontSize: '12px', color: 'var(--a-primary)', fontWeight: 500, marginLeft: '8px' }}>
                                                            ครู: {booking.bookingItems[0].teacher.name}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '13px', color: 'var(--a-text-secondary)', display: 'flex', gap: '12px', marginTop: '2px' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <MapPin size={12} /> {booking.bookingItems[0]?.court?.name}
                                                    </span>
                                                    <span>{booking.participants.map(p => p.sportType).join(', ')}</span>
                                                    <span>{booking.user?.phone}</span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span className={`badge ${statusMap[booking.status]?.cls || 'badge-info'}`}>
                                                    {statusMap[booking.status]?.label || booking.status}
                                                </span>
                                                <div style={{ fontWeight: 700, fontSize: '14px', marginTop: '4px', color: 'var(--a-text)' }}>
                                                    ฿{booking.totalAmount.toLocaleString()}
                                                </div>
                                            </div>
                                            <Eye size={16} style={{ color: 'var(--a-text-muted)' }} />
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Booking detail modal with edit */}
            {viewBooking && (

                <div className="modal-overlay" onClick={() => setViewBooking(null)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>รายละเอียดการจอง</h2>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span className={`badge ${statusMap[viewBooking.status]?.cls}`}>{statusMap[viewBooking.status]?.label}</span>
                                <button onClick={() => setEditMode(!editMode)} className="btn-admin-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>
                                    {editMode ? '🔒 ยกเลิกแก้ไข' : '✏️ แก้ไข'}
                                </button>
                            </div>
                        </div>

                        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '10px', marginBottom: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                                <div><strong>หมายเลข:</strong> {viewBooking.bookingNumber}</div>
                                <div>
                                    <strong>ยอดเงิน:</strong>{' '}
                                    {editMode ? (
                                        <input type="number" value={editAmount} onChange={e => setEditAmount(parseFloat(e.target.value) || 0)}
                                            style={{ width: '100px', padding: '2px 6px', border: '1px dashed #93c5fd', borderRadius: '4px', fontFamily: "'Inter'", fontWeight: 700 }} />
                                    ) : `฿${viewBooking.totalAmount.toLocaleString()}`}
                                </div>
                                <div><strong>ลูกค้า:</strong> {viewBooking.user?.name}</div>
                                <div><strong>โทร:</strong> {viewBooking.user?.phone || '-'}</div>
                                <div><strong>อีเมล:</strong> {viewBooking.user?.email}</div>
                                <div><strong>วันที่จอง:</strong> {new Date(viewBooking.createdAt).toLocaleDateString('th-TH')}</div>
                                {editMode && (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <strong>สถานะ:</strong>{' '}
                                        <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--a-border)', marginLeft: '8px' }}>
                                            <option value="PENDING">รอชำระ</option>
                                            <option value="CONFIRMED">ยืนยัน</option>
                                            <option value="CANCELLED">ยกเลิก</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        <h3 style={{ fontWeight: 700, marginBottom: '8px', fontSize: '15px' }}>รายการจอง</h3>
                        {viewBooking.bookingItems.map((item, i) => (
                            <div key={i} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--a-border)', marginBottom: '8px', fontSize: '14px' }}>
                                <div style={{ fontWeight: 600 }}>{item.court.name}</div>
                                <div style={{ color: 'var(--a-text-secondary)' }}>
                                    {new Date(item.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} | {item.startTime} - {item.endTime} | ฿{item.price.toLocaleString()}
                                </div>
                                {item.teacher && (
                                    <div style={{ fontSize: '12px', color: 'var(--a-primary)', marginTop: '4px' }}>👨‍🏫 ครู: {item.teacher.name}</div>
                                )}
                            </div>
                        ))}

                        <h3 style={{ fontWeight: 700, marginBottom: '8px', marginTop: '16px', fontSize: '15px' }}>ผู้เรียน</h3>
                        {(editMode ? editParticipants : viewBooking.participants).map((p, i) => (
                            <div key={i} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--a-border)', marginBottom: '8px', fontSize: '14px' }}>
                                {editMode ? (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input value={p.name} onChange={e => {
                                            const updated = [...editParticipants]
                                            updated[i] = { ...updated[i], name: e.target.value }
                                            setEditParticipants(updated)
                                        }} placeholder="ชื่อ" style={{ flex: 1, padding: '4px 8px', border: '1px dashed #93c5fd', borderRadius: '4px' }} />
                                        <input value={p.sportType} onChange={e => {
                                            const updated = [...editParticipants]
                                            updated[i] = { ...updated[i], sportType: e.target.value }
                                            setEditParticipants(updated)
                                        }} placeholder="ประเภทกีฬา" style={{ width: '120px', padding: '4px 8px', border: '1px dashed #93c5fd', borderRadius: '4px' }} />
                                    </div>
                                ) : (
                                    <span><strong>{p.name}</strong> - {p.sportType} {p.phone && `| ${p.phone}`}</span>
                                )}
                            </div>
                        ))}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
                            {editMode ? (
                                <>
                                    <button onClick={() => setEditMode(false)} className="btn-admin-outline">ยกเลิก</button>
                                    <button onClick={saveChanges} disabled={saving} className="btn-admin">
                                        {saving ? 'กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {viewBooking.status !== 'CANCELLED' && (
                                        <button onClick={async () => {
                                            const reason = prompt('ระบุเหตุผลในการยกเลิก:')
                                            if (reason === null) return
                                            const res = await fetch('/api/bookings', {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ bookingId: viewBooking.id, action: 'cancel', reason }),
                                            })
                                            if (res.ok) {
                                                toast.success('ยกเลิกการจองสำเร็จ')
                                                setViewBooking(null)
                                                const fetchRes = await fetch(`/api/bookings?date=${selectedDate}`, { cache: 'no-store' })
                                                const data = await fetchRes.json()
                                                if (data.bookings) setBookings(data.bookings)
                                            }
                                        }} className="btn-admin-outline" style={{ color: '#e17055', borderColor: '#e17055' }}>ยกเลิกการจอง</button>
                                    )}
                                    {viewBooking.status === 'PENDING' && (
                                        <button onClick={async () => {
                                            const res = await fetch('/api/bookings', {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ bookingId: viewBooking.id, status: 'CONFIRMED' }),
                                            })
                                            if (res.ok) {
                                                toast.success('ยืนยันการจองสำเร็จ')
                                                setViewBooking(null)
                                                const fetchRes = await fetch(`/api/bookings?date=${selectedDate}`, { cache: 'no-store' })
                                                const data = await fetchRes.json()
                                                if (data.bookings) setBookings(data.bookings)
                                            }
                                        }} className="btn-admin">ยืนยันการจอง</button>
                                    )}
                                    <button onClick={() => setViewBooking(null)} className="btn-admin-outline">ปิด</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
