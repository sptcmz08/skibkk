'use client'

import { useState, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Eye, UserPlus, Clock, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'

interface Booking {
    id: string; bookingNumber: string; status: string; totalAmount: number; createdAt: string; isBookerLearner: boolean
    user: { name: string; email: string; phone: string }
    bookingItems: Array<{ court: { name: string }; date: string; startTime: string; endTime: string; price: number; teacher?: { name: string } }>
    participants: Array<{ name: string; sportType: string; phone: string }>
    payments: Array<{ method: string; status: string; amount: number }>
}

export default function CalendarPage() {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [viewBooking, setViewBooking] = useState<Booking | null>(null)

    useEffect(() => {
        fetchBookings()
    }, [selectedDate])

    const fetchBookings = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/bookings?date=${selectedDate}`)
            const data = await res.json()
            if (data.bookings) setBookings(data.bookings)
        } catch { toast.error('โหลดข้อมูลไม่สำเร็จ') }
        finally { setLoading(false) }
    }

    const changeDate = (delta: number) => {
        const d = new Date(selectedDate)
        d.setDate(d.getDate() + delta)
        setSelectedDate(d.toISOString().split('T')[0])
    }

    const statusMap: Record<string, { cls: string; label: string }> = {
        PENDING: { cls: 'badge-pending', label: 'รอชำระ' },
        CONFIRMED: { cls: 'badge-success', label: 'ยืนยัน' },
        CANCELLED: { cls: 'badge-danger', label: 'ยกเลิก' },
    }

    const timeSlots = Array.from({ length: 16 }, (_, i) => `${(i + 9).toString().padStart(2, '0')}:00`)

    return (
        <div>
            {/* Date picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <button onClick={() => changeDate(-1)} className="btn-admin-outline" style={{ padding: '8px' }}><ChevronLeft size={18} /></button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={20} style={{ color: 'var(--a-primary)' }} />
                    <input type="date" className="admin-input" style={{ width: 'auto', fontWeight: 600 }} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                    <span style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>
                        {new Date(selectedDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                </div>
                <button onClick={() => changeDate(1)} className="btn-admin-outline" style={{ padding: '8px' }}><ChevronRight size={18} /></button>
                <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="btn-admin" style={{ padding: '8px 16px', fontSize: '13px' }}>วันนี้</button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)', margin: '0 auto' }} /></div>
            ) : (
                <>
                    {/* Timeline view */}
                    <div className="admin-card" style={{ marginBottom: '24px' }}>
                        <div className="admin-card-header">
                            <h3 className="admin-card-title">ตารางการจอง - {new Date(selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long' })}</h3>
                            <span className="badge badge-info">{bookings.length} การจอง</span>
                        </div>
                        <div style={{ padding: '16px', overflowX: 'auto' }}>
                            {bookings.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>
                                    <Calendar size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                                    <p>ไม่มีการจองในวันนี้</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {bookings.sort((a, b) => (a.bookingItems[0]?.startTime || '').localeCompare(b.bookingItems[0]?.startTime || '')).map(booking => (
                                        <div key={booking.id} style={{
                                            display: 'flex', alignItems: 'center', gap: '16px',
                                            padding: '12px 16px', borderRadius: '10px',
                                            background: booking.status === 'CONFIRMED' ? '#e8f5e9' : booking.status === 'PENDING' ? '#fff8e1' : '#fde4de',
                                            border: `1px solid ${booking.status === 'CONFIRMED' ? '#c8e6c9' : booking.status === 'PENDING' ? '#ffecb3' : '#ffccbc'}`,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }} onClick={() => setViewBooking(booking)}>
                                            <div style={{ minWidth: '80px' }}>
                                                <div style={{ fontWeight: 800, fontSize: '16px', fontFamily: "'Inter'", color: 'var(--a-text)' }}>
                                                    {booking.bookingItems[0]?.startTime || '--:--'}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>
                                                    {booking.bookingItems[0]?.endTime || '--:--'}
                                                </div>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--a-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {booking.user?.name}
                                                    {booking.bookingItems[0]?.teacher && (
                                                        <span style={{ fontSize: '12px', color: 'var(--a-primary)', fontWeight: 500 }}>
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
                </>
            )}

            {/* Booking detail modal */}
            {viewBooking && (
                <div className="modal-overlay" onClick={() => setViewBooking(null)}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>รายละเอียดการจอง</h2>
                            <span className={`badge ${statusMap[viewBooking.status]?.cls}`}>{statusMap[viewBooking.status]?.label}</span>
                        </div>

                        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '10px', marginBottom: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                                <div><strong>หมายเลข:</strong> {viewBooking.bookingNumber}</div>
                                <div><strong>ยอดเงิน:</strong> ฿{viewBooking.totalAmount.toLocaleString()}</div>
                                <div><strong>ลูกค้า:</strong> {viewBooking.user?.name}</div>
                                <div><strong>โทร:</strong> {viewBooking.user?.phone || '-'}</div>
                                <div><strong>อีเมล:</strong> {viewBooking.user?.email}</div>
                                <div><strong>วันที่จอง:</strong> {new Date(viewBooking.createdAt).toLocaleDateString('th-TH')}</div>
                            </div>
                        </div>

                        <h3 style={{ fontWeight: 700, marginBottom: '8px', fontSize: '15px' }}>รายการจอง</h3>
                        {viewBooking.bookingItems.map((item, i) => (
                            <div key={i} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--a-border)', marginBottom: '8px', fontSize: '14px' }}>
                                <div style={{ fontWeight: 600 }}>{item.court.name}</div>
                                <div style={{ color: 'var(--a-text-secondary)' }}>
                                    {new Date(item.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} | {item.startTime} - {item.endTime} | ฿{item.price.toLocaleString()}
                                </div>
                            </div>
                        ))}

                        <h3 style={{ fontWeight: 700, marginBottom: '8px', marginTop: '16px', fontSize: '15px' }}>ผู้เรียน</h3>
                        {viewBooking.participants.map((p, i) => (
                            <div key={i} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--a-border)', marginBottom: '8px', fontSize: '14px' }}>
                                <strong>{p.name}</strong> - {p.sportType} {p.phone && `| ${p.phone}`}
                            </div>
                        ))}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setViewBooking(null)} className="btn-admin-outline">ปิด</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
