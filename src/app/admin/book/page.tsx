'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Calendar, Clock, MapPin, Search, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface Court { id: string; name: string; sportType: string }
interface Customer { id: string; name: string; email: string; phone: string }

export default function AdminBookingPage() {
    const [courts, setCourts] = useState<Court[]>([])
    const [customers, setCustomers] = useState<Customer[]>([])
    const [search, setSearch] = useState('')
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [selectedCourt, setSelectedCourt] = useState('')
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [selectedTime, setSelectedTime] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        // Fetch courts
        fetch('/api/courts').then(r => r.json()).then(d => setCourts(d.courts || [])).catch(() => { })
    }, [])

    // Search customers
    useEffect(() => {
        if (search.length < 2) { setCustomers([]); return }
        const t = setTimeout(() => {
            fetch(`/api/users?search=${encodeURIComponent(search)}`).then(r => r.json())
                .then(d => setCustomers(d.users || []))
                .catch(() => { })
        }, 300)
        return () => clearTimeout(t)
    }, [search])

    const timeSlots = Array.from({ length: 14 }, (_, i) => {
        const h = (i + 9).toString().padStart(2, '0')
        return `${h}:00`
    })

    const handleSubmit = async () => {
        if (!selectedCustomer || !selectedCourt || !selectedDate || !selectedTime) {
            toast.error('กรุณากรอกข้อมูลให้ครบ')
            return
        }
        setLoading(true)
        try {
            const court = courts.find(c => c.id === selectedCourt)
            const endHour = (parseInt(selectedTime.split(':')[0]) + 1).toString().padStart(2, '0')
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: [{
                        courtId: selectedCourt,
                        courtName: court?.name,
                        date: selectedDate,
                        startTime: selectedTime,
                        endTime: `${endHour}:00`,
                        price: 0,
                    }],
                    totalAmount: 0,
                    isBookerLearner: false,
                    participants: [{ name: selectedCustomer.name, sportType: court?.sportType || '-', isBooker: true }],
                    createdByAdmin: true,
                    userId: selectedCustomer.id,
                }),
            })
            if (res.ok) {
                // Auto-confirm admin booking
                const data = await res.json()
                await fetch('/api/bookings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bookingId: data.booking.id, status: 'CONFIRMED' }),
                })
                setSuccess(true)
                toast.success('จองให้ลูกค้าสำเร็จ!')
            } else {
                const err = await res.json()
                toast.error(err.error || 'จองไม่สำเร็จ')
            }
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setLoading(false) }
    }

    if (success) {
        return (
            <div style={{ textAlign: 'center', padding: '60px' }}>
                <Check size={60} style={{ color: '#00b894', marginBottom: '16px' }} />
                <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>จองสำเร็จ!</h2>
                <p style={{ color: 'var(--a-text-secondary)' }}>การจองถูกยืนยันแล้ว</p>
                <button onClick={() => { setSuccess(false); setSelectedCustomer(null); setSelectedCourt(''); setSelectedTime('') }} className="btn-admin" style={{ marginTop: '24px' }}>จองเพิ่ม</button>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: '700px' }}>
            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserPlus size={22} style={{ color: 'var(--a-primary)' }} /> จองให้ลูกค้า
                </h2>
                <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px', marginTop: '4px' }}>สร้างการจองใหม่โดย Admin</p>
            </div>

            {/* Customer search */}
            <div className="admin-card" style={{ marginBottom: '16px' }}>
                <div style={{ padding: '16px' }}>
                    <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>ค้นหาลูกค้า</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--a-text-muted)' }} />
                        <input className="admin-input" style={{ paddingLeft: '36px' }} placeholder="พิมพ์ชื่อ / เบอร์โทร / อีเมล" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    {customers.length > 0 && !selectedCustomer && (
                        <div style={{ border: '1px solid var(--a-border)', borderRadius: '8px', marginTop: '8px', maxHeight: '200px', overflow: 'auto' }}>
                            {customers.map(c => (
                                <button key={c.id} onClick={() => { setSelectedCustomer(c); setSearch(c.name) }}
                                    style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid var(--a-border)', fontSize: '14px' }}>
                                    <strong>{c.name}</strong> <span style={{ color: 'var(--a-text-muted)' }}>{c.phone} • {c.email}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {selectedCustomer && (
                        <div style={{ marginTop: '8px', padding: '10px 14px', background: '#e8f5e9', borderRadius: '8px', fontSize: '14px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>✅ <strong>{selectedCustomer.name}</strong> ({selectedCustomer.phone})</span>
                            <button onClick={() => { setSelectedCustomer(null); setSearch('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e17055', fontWeight: 600 }}>เปลี่ยน</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Court + Date + Time */}
            <div className="admin-card" style={{ marginBottom: '16px' }}>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={14} /> สนาม</label>
                        <select className="admin-input" value={selectedCourt} onChange={e => setSelectedCourt(e.target.value)}>
                            <option value="">เลือกสนาม</option>
                            {courts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.sportType})</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> วันที่</label>
                        <input type="date" className="admin-input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                    </div>
                    <div>
                        <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> เวลา</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                            {timeSlots.map(t => (
                                <button key={t} onClick={() => setSelectedTime(t)}
                                    className={selectedTime === t ? 'btn-admin' : 'btn-admin-outline'}
                                    style={{ padding: '8px', fontSize: '13px' }}>{t}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <button onClick={handleSubmit} className="btn-admin" disabled={loading || !selectedCustomer || !selectedCourt || !selectedTime}
                style={{ width: '100%', padding: '14px', fontSize: '16px', fontWeight: 700 }}>
                {loading ? 'กำลังจอง...' : 'ยืนยันการจอง'}
            </button>
        </div>
    )
}
