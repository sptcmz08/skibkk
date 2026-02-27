'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight, Check, Search, UserPlus, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Slot { startTime: string; endTime: string; available: boolean; price: number; status: string; isPast?: boolean }
interface CourtData { courtId: string; courtName: string; sportType: string | null; closed: boolean; slots: Slot[] }
interface Customer { id: string; name: string; email: string; phone: string }

const MONTH_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const DAY_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const SPORT_ICONS: Record<string, string> = { 'สกี้': '⛷️', 'สโนบอร์ด': '🏂', 'ฟุตบอล': '⚽', 'แบดมินตัน': '🏸', 'บาสเกตบอล': '🏀' }

// Step wizard (admin theme)
function StepWizard({ step }: { step: number }) {
    const steps = [
        { num: 1, label: 'เลือกลูกค้า' },
        { num: 2, label: 'เลือกประเภทกีฬา' },
        { num: 3, label: 'เลือกวันที่' },
        { num: 4, label: 'เลือกเวลา' },
        { num: 5, label: 'ข้อมูลผู้เรียน' },
    ]
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', marginBottom: '28px', flexWrap: 'wrap' }}>
            {steps.map((s, i) => {
                const done = s.num < step
                const active = s.num === step
                return (
                    <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', borderRadius: '8px',
                            background: done ? 'rgba(39,174,96,0.08)' : active ? 'rgba(245,166,35,0.12)' : 'transparent',
                        }}>
                            <div style={{
                                width: '24px', height: '24px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '11px', fontWeight: 700, flexShrink: 0,
                                background: done ? '#27ae60' : active ? 'var(--a-primary)' : '#e0e0e0',
                                color: (done || active) ? 'white' : '#999',
                            }}>
                                {done ? <Check size={12} /> : s.num}
                            </div>
                            <span style={{
                                fontSize: '12px', fontWeight: active ? 700 : 500,
                                color: done ? '#27ae60' : active ? 'var(--a-text)' : 'var(--a-text-muted)',
                            }}>{s.label}</span>
                        </div>
                        {i < 4 && <div style={{ width: '12px', height: '1px', background: '#e0e0e0' }} />}
                    </div>
                )
            })}
        </div>
    )
}

export default function AdminBookPage() {
    const [step, setStep] = useState(1)

    // Step 1: Customer
    const [customers, setCustomers] = useState<Customer[]>([])
    const [bookSearch, setBookSearch] = useState('')
    const [bookCustomer, setBookCustomer] = useState<Customer | null>(null)

    // Step 2: Sport Type
    const [sportTypes, setSportTypes] = useState<Array<{ name: string; icon: string; color: string }>>([])
    const [selectedSport, setSelectedSport] = useState<string | null>(null)

    // Step 3: Calendar
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [viewYear, setViewYear] = useState(today.getFullYear())
    const [viewMonth, setViewMonth] = useState(today.getMonth())
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [calAvail, setCalAvail] = useState<Record<string, { totalSlots: number; bookedSlots: number; status: string }>>({})

    // Step 4: Time slots
    const [availability, setAvailability] = useState<CourtData[]>([])
    const [selectedCourt, setSelectedCourt] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [cart, setCart] = useState<Array<{ courtId: string; courtName: string; date: string; startTime: string; endTime: string; price: number }>>([])

    // Step 5: Participants & Submit
    const [participants, setParticipants] = useState<Array<{ name: string; sportType: string; phone: string }>>([{ name: '', sportType: '', phone: '' }])
    const [bookStatus, setBookStatus] = useState<'CONFIRMED' | 'PENDING'>('CONFIRMED')
    const [submitting, setSubmitting] = useState(false)

    // Customer search
    useEffect(() => {
        if (bookSearch.length < 2) { setCustomers([]); return }
        const t = setTimeout(() => {
            fetch(`/api/users?search=${encodeURIComponent(bookSearch)}&role=USER`)
                .then(r => r.json())
                .then(d => setCustomers(d.users || []))
                .catch(() => { })
        }, 300)
        return () => clearTimeout(t)
    }, [bookSearch])

    // Load sport types
    useEffect(() => {
        fetch('/api/sport-types', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => {
                const active = (d.sportTypes || []).filter((s: any) => s.isActive)
                setSportTypes(active)
                if (active.length === 0) {
                    // Skip sport type selection
                    setStep(s => s === 2 ? 3 : s)
                }
            })
            .catch(() => { })
    }, [])

    // Fetch monthly availability for calendar
    useEffect(() => {
        if (step !== 3 || !selectedSport) return
        const startDate = new Date(viewYear, viewMonth, 1)
        const endDate = new Date(viewYear, viewMonth + 1, 0)
        const promises: Promise<void>[] = []
        const avail: Record<string, { totalSlots: number; bookedSlots: number; status: string }> = {}

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            promises.push(
                fetch(`/api/availability?date=${dateStr}`, { cache: 'no-store' })
                    .then(r => r.json())
                    .then(data => {
                        const courts = (data.availability || []).filter((c: any) => c.sportType === selectedSport && !c.closed)
                        let total = 0, booked = 0
                        courts.forEach((c: any) => {
                            c.slots?.forEach((s: Slot) => { total++; if (!s.available) booked++ })
                        })
                        const pct = total > 0 ? booked / total : 0
                        avail[dateStr] = {
                            totalSlots: total, bookedSlots: booked,
                            status: total === 0 ? 'closed' : pct >= 1 ? 'full' : pct >= 0.7 ? 'almost_full' : 'available',
                        }
                    })
                    .catch(() => { })
            )
        }
        Promise.all(promises).then(() => setCalAvail(avail))
    }, [step, viewYear, viewMonth, selectedSport])

    // Fetch availability for selected date
    const fetchAvailability = useCallback(async (date: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/availability?date=${date}`, { cache: 'no-store' })
            const data = await res.json()
            const courts = (data.availability || []).filter((c: CourtData) => c.sportType === selectedSport && !c.closed)
            setAvailability(courts)
            if (courts.length > 0 && !selectedCourt) setSelectedCourt(courts[0].courtId)
        } catch { setAvailability([]) }
        finally { setLoading(false) }
    }, [selectedSport, selectedCourt])

    const handleSelectDate = (dateStr: string) => {
        setSelectedDate(dateStr)
        fetchAvailability(dateStr)
        setStep(4)
    }

    const isInCart = (courtId: string, date: string, startTime: string) =>
        cart.some(i => i.courtId === courtId && i.date === date && i.startTime === startTime)

    const toggleSlot = (court: CourtData, slot: Slot) => {
        if (!selectedDate) return
        if (isInCart(court.courtId, selectedDate, slot.startTime)) {
            setCart(cart.filter(i => !(i.courtId === court.courtId && i.date === selectedDate && i.startTime === slot.startTime)))
            toast.success('ลบออกจากรายการแล้ว')
        } else {
            setCart([...cart, {
                courtId: court.courtId, courtName: court.courtName,
                date: selectedDate, startTime: slot.startTime, endTime: slot.endTime, price: slot.price,
            }])
            toast.success(`เพิ่ม ${slot.startTime} ลงรายการแล้ว`)
        }
    }

    const currentCourt = availability.find(c => c.courtId === selectedCourt)

    // Calendar helpers
    const getDaysInMonth = () => {
        const firstDay = new Date(viewYear, viewMonth, 1)
        const lastDay = new Date(viewYear, viewMonth + 1, 0)
        const startDow = firstDay.getDay()
        const days: (Date | null)[] = []
        for (let i = 0; i < startDow; i++) days.push(null)
        for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(viewYear, viewMonth, d))
        return days
    }
    const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }
    const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }

    const formatDateTH = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00')
        return `${d.getDate()} ${MONTH_TH[d.getMonth()]} ${d.getFullYear() + 543}`
    }

    // Submit booking
    const submitBooking = async () => {
        if (!bookCustomer) { toast.error('กรุณาเลือกลูกค้า'); return }
        if (cart.length === 0) { toast.error('กรุณาเลือกเวลา'); return }
        const validParticipants = participants.filter(p => p.name.trim())
        if (validParticipants.length === 0) { toast.error('กรุณากรอกชื่อผู้เรียนอย่างน้อย 1 คน'); return }

        setSubmitting(true)
        try {
            const totalAmount = cart.reduce((sum, i) => sum + i.price, 0)
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart,
                    totalAmount,
                    isBookerLearner: false,
                    participants: validParticipants.map((p, i) => ({ ...p, isBooker: i === 0 })),
                    createdByAdmin: true,
                    userId: bookCustomer.id,
                }),
            })

            if (res.ok) {
                const data = await res.json()
                await fetch('/api/bookings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bookingId: data.booking.id, status: bookStatus }),
                })
                toast.success(`จองสำเร็จ! (${cart.length} รายการ) — ${bookStatus === 'CONFIRMED' ? 'จ่ายแล้ว' : 'รอชำระ'}`)
                // Reset
                setStep(1); setBookCustomer(null); setBookSearch(''); setSelectedSport(null)
                setSelectedDate(null); setCart([]); setAvailability([]); setSelectedCourt(null)
                setParticipants([{ name: '', sportType: '', phone: '' }]); setBookStatus('CONFIRMED')
            } else {
                const err = await res.json().catch(() => ({}))
                toast.error(err.error || 'จองไม่สำเร็จ')
            }
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setSubmitting(false) }
    }

    // ── STEP 1: เลือกลูกค้า ──
    if (step === 1) {
        return (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <StepWizard step={1} />
                <h2 style={{ fontSize: '20px', fontWeight: 800, textAlign: 'center', marginBottom: '8px' }}>เลือกลูกค้า</h2>
                <p style={{ textAlign: 'center', color: 'var(--a-text-muted)', marginBottom: '28px', fontSize: '14px' }}>ค้นหาลูกค้าที่ต้องการจองให้</p>

                <div className="admin-card" style={{ padding: '20px' }}>
                    <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--a-text-muted)' }} />
                        <input className="admin-input" style={{ paddingLeft: '36px' }} placeholder="พิมพ์ชื่อ / เบอร์โทร / อีเมล" value={bookSearch} onChange={e => { setBookSearch(e.target.value); if (bookCustomer) setBookCustomer(null) }} />
                    </div>

                    {customers.length > 0 && !bookCustomer && (
                        <div style={{ border: '1px solid var(--a-border)', borderRadius: '8px', maxHeight: '200px', overflow: 'auto' }}>
                            {customers.map(c => (
                                <button key={c.id} onClick={() => { setBookCustomer(c); setBookSearch(c.name); setCustomers([]) }}
                                    style={{ display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid var(--a-border)', fontSize: '14px', fontFamily: 'inherit' }}>
                                    <strong>{c.name}</strong> <span style={{ color: 'var(--a-text-muted)' }}>{c.phone} · {c.email}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {bookCustomer && (
                        <div style={{ padding: '12px 16px', background: '#e8f5e9', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <span>✅ <strong>{bookCustomer.name}</strong> ({bookCustomer.phone})</span>
                            <button onClick={() => { setBookCustomer(null); setBookSearch('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e17055', fontWeight: 600, fontFamily: 'inherit' }}>เปลี่ยน</button>
                        </div>
                    )}

                    {bookCustomer && (
                        <button onClick={() => setStep(2)} className="btn-admin" style={{ width: '100%', padding: '14px', fontSize: '16px', fontWeight: 700 }}>
                            ถัดไป →
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // ── STEP 2: เลือกประเภทกีฬา ──
    if (step === 2) {
        return (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <StepWizard step={2} />
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <button onClick={() => setStep(1)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '999px', border: '1px solid var(--a-border)', background: 'white', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>
                        <ArrowLeft size={14} /> {bookCustomer?.name}
                    </button>
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, textAlign: 'center', marginBottom: '8px' }}>เลือกประเภทกีฬา</h2>
                <p style={{ textAlign: 'center', color: 'var(--a-text-muted)', marginBottom: '28px', fontSize: '14px' }}>เลือกกิจกรรมที่ต้องการจอง</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                    {sportTypes.map(st => (
                        <button key={st.name} onClick={() => { setSelectedSport(st.name); setStep(3) }}
                            style={{
                                padding: '32px 16px', borderRadius: '16px', cursor: 'pointer',
                                border: `2px solid ${st.color}33`, background: `${st.color}08`,
                                color: 'var(--a-text)', fontFamily: 'inherit', textAlign: 'center',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                                transition: 'transform 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                            <span style={{ fontSize: '46px', lineHeight: 1 }}>{st.icon || SPORT_ICONS[st.name] || '🏟️'}</span>
                            <span style={{ fontSize: '18px', fontWeight: 800 }}>{st.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    // ── STEP 3: เลือกวันที่ ──
    if (step === 3) {
        const calDays = getDaysInMonth()
        return (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <StepWizard step={3} />
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <button onClick={() => setStep(1)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', borderRadius: '999px', border: '1px solid var(--a-border)', background: 'white', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
                        👤 {bookCustomer?.name}
                    </button>
                    <button onClick={() => setStep(2)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', borderRadius: '999px', border: '1px solid var(--a-border)', background: 'white', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
                        {SPORT_ICONS[selectedSport || ''] || '🏟️'} {selectedSport}
                    </button>
                </div>

                <div className="admin-card" style={{ padding: '20px' }}>
                    {/* Month nav */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <button onClick={prevMonth} className="btn-admin-outline" style={{ padding: '6px 12px' }}><ChevronLeft size={18} /></button>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: 800 }}>{MONTH_TH[viewMonth]}</div>
                            <div style={{ fontSize: '13px', color: 'var(--a-text-muted)' }}>{viewYear + 543}</div>
                        </div>
                        <button onClick={nextMonth} className="btn-admin-outline" style={{ padding: '6px 12px' }}><ChevronRight size={18} /></button>
                    </div>

                    {/* Day headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
                        {DAY_TH.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--a-text-muted)', padding: '6px 0' }}>{d}</div>)}
                    </div>

                    {/* Calendar grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                        {calDays.map((date, idx) => {
                            if (!date) return <div key={`e-${idx}`} />
                            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                            const isPast = date < today
                            const isToday = date.getTime() === today.getTime()
                            const dayInfo = calAvail[dateStr]
                            const dayStatus = dayInfo?.status || (isPast ? 'past' : 'available')
                            const freeSlots = dayInfo ? dayInfo.totalSlots - dayInfo.bookedSlots : 0
                            const isClosed = dayStatus === 'closed'
                            const isSun = date.getDay() === 0
                            const isSat = date.getDay() === 6

                            const statusConfig = dayStatus === 'full'
                                ? { bg: '#fde8e8', border: 'rgba(225,112,85,0.4)', text: 'เต็ม', color: '#e17055' }
                                : dayStatus === 'almost_full'
                                    ? { bg: '#fff8e1', border: 'rgba(245,166,35,0.4)', text: `เหลือ ${freeSlots}`, color: '#f5a623' }
                                    : { bg: '#e8f5e9', border: 'rgba(39,174,96,0.3)', text: 'ว่าง', color: '#27ae60' }

                            return (
                                <button key={dateStr} onClick={() => !isPast && !isClosed && handleSelectDate(dateStr)}
                                    disabled={isPast || isClosed}
                                    style={{
                                        borderRadius: '10px', cursor: isPast || isClosed ? 'not-allowed' : 'pointer',
                                        border: isToday ? '2px solid var(--a-primary)' : `1px solid ${!isPast && dayInfo ? statusConfig.border : 'var(--a-border)'}`,
                                        background: isPast ? '#f8f8f8' : isClosed ? '#fafafa' : dayInfo ? statusConfig.bg : 'white',
                                        color: isPast ? '#bbb' : isSun ? '#e17055' : isSat ? '#6c5ce7' : 'var(--a-text)',
                                        fontWeight: isToday ? 800 : 600, fontSize: '14px', fontFamily: "'Inter', sans-serif",
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                                        opacity: isPast ? 0.5 : isClosed ? 0.4 : 1, minHeight: '56px', padding: '4px 2px',
                                        textDecoration: isPast ? 'line-through' : 'none', transition: 'transform 0.1s',
                                    }}
                                    onMouseEnter={e => !isPast && !isClosed && (e.currentTarget.style.transform = 'scale(1.06)')}
                                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                                    {date.getDate()}
                                    {!isPast && !isClosed && dayInfo && (
                                        <span style={{ fontSize: '9px', fontWeight: 700, color: statusConfig.color, lineHeight: 1, whiteSpace: 'nowrap' }}>{statusConfig.text}</span>
                                    )}
                                    {isClosed && <span style={{ fontSize: '8px', color: '#e17055', fontWeight: 700 }}>ปิด</span>}
                                </button>
                            )
                        })}
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
                        {[{ color: '#27ae60', label: 'ว่าง' }, { color: '#f5a623', label: 'ใกล้เต็ม' }, { color: '#e17055', label: 'เต็ม' }, { color: '#bbb', label: 'ผ่านแล้ว' }].map(s => (
                            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--a-text-muted)' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />{s.label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // ── STEP 4: เลือกเวลา ──
    if (step === 4) {
        return (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <StepWizard step={4} />
                {/* Breadcrumbs */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <button onClick={() => setStep(1)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', borderRadius: '999px', border: '1px solid var(--a-border)', background: 'white', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>👤 {bookCustomer?.name}</button>
                    <button onClick={() => setStep(2)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', borderRadius: '999px', border: '1px solid var(--a-border)', background: 'white', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>{SPORT_ICONS[selectedSport || ''] || '🏟️'} {selectedSport}</button>
                    <button onClick={() => setStep(3)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', borderRadius: '999px', border: '1px solid #27ae60', background: '#e8f5e9', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', color: '#27ae60', fontWeight: 600 }}>
                        <Calendar size={13} /> {selectedDate ? formatDateTH(selectedDate) : ''}
                    </button>
                </div>

                {/* Court tabs */}
                {availability.length > 1 && (
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={16} style={{ color: 'var(--a-primary)' }} /> เลือกสนาม
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {availability.map(court => {
                                const active = selectedCourt === court.courtId
                                return (
                                    <button key={court.courtId} onClick={() => setSelectedCourt(court.courtId)} style={{
                                        padding: '10px 22px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit',
                                        border: active ? '2px solid var(--a-primary)' : '1px solid var(--a-border)',
                                        background: active ? 'var(--a-primary-light)' : 'white', color: active ? 'var(--a-primary)' : 'var(--a-text)',
                                        fontWeight: 700, fontSize: '14px', transition: 'all 0.15s',
                                    }}>{court.courtName}</button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Time slots grid */}
                <div className="admin-card" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={18} style={{ color: 'var(--a-primary)' }} /> เลือกช่วงเวลา
                        {currentCourt && availability.length === 1 && <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--a-text-muted)' }}>— {currentCourt.courtName}</span>}
                    </h3>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)', margin: '0 auto' }} /></div>
                    ) : !currentCourt || currentCourt.slots.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--a-text-muted)' }}>
                            <p style={{ fontWeight: 600, marginBottom: '8px' }}>ไม่มีเวลาว่างในวันนี้</p>
                            <button onClick={() => setStep(3)} className="btn-admin-outline" style={{ padding: '8px 20px' }}>เลือกวันอื่น</button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                            {currentCourt.slots.map(slot => {
                                const inCart = selectedDate ? isInCart(currentCourt.courtId, selectedDate, slot.startTime) : false
                                const isBooked = !slot.available && !inCart
                                const isPast = slot.status === 'past'
                                const isDisabled = isBooked || isPast

                                return (
                                    <button key={slot.startTime}
                                        onClick={() => !isDisabled && toggleSlot(currentCourt, slot)}
                                        disabled={isDisabled}
                                        style={{
                                            padding: '14px 8px', borderRadius: '10px',
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            border: inCart ? '2px solid var(--a-primary)' : isPast ? '1px solid #eee' : isBooked ? '1px solid #eee' : '1px solid #c6f6d5',
                                            background: inCart ? 'var(--a-primary-light)' : isPast ? '#f8f8f8' : isBooked ? '#fde8e8' : '#f0fff4',
                                            color: isPast ? '#bbb' : isBooked ? '#ccc' : inCart ? 'var(--a-primary)' : '#27ae60',
                                            fontFamily: "'Inter', sans-serif", textAlign: 'center',
                                            opacity: isBooked ? 0.4 : isPast ? 0.5 : 1, transition: 'all 0.15s',
                                            textDecoration: isPast ? 'line-through' : 'none',
                                        }}>
                                        <div style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1 }}>{slot.startTime}–{slot.endTime}</div>
                                        {isPast && <div style={{ fontSize: '10px', marginTop: '4px', color: '#e17055', fontWeight: 700 }}>⛔ เลยเวลา</div>}
                                        {isBooked && !isPast && <div style={{ fontSize: '10px', marginTop: '4px' }}>จองแล้ว</div>}
                                        {inCart && <div style={{ fontSize: '10px', marginTop: '4px', fontWeight: 700 }}>✓ เลือกแล้ว</div>}
                                        {!isBooked && !inCart && !isPast && <div style={{ fontSize: '11px', marginTop: '4px', color: '#999' }}>฿{slot.price.toLocaleString()}</div>}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Cart summary bar */}
                {cart.length > 0 && (
                    <div style={{ marginTop: '16px', padding: '14px 20px', background: 'var(--a-primary-light)', borderRadius: '12px', border: '1px solid var(--a-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ fontSize: '14px' }}>
                            <strong>{cart.length} รายการ</strong> · <strong style={{ fontFamily: "'Inter'", color: 'var(--a-primary)' }}>฿{cart.reduce((s, i) => s + i.price, 0).toLocaleString()}</strong>
                        </div>
                        <button onClick={() => setStep(5)} className="btn-admin" style={{ padding: '10px 24px', fontWeight: 700, fontSize: '15px' }}>
                            ถัดไป → ข้อมูลผู้เรียน
                        </button>
                    </div>
                )}
            </div>
        )
    }

    // ── STEP 5: ข้อมูลผู้เรียน & ยืนยัน ──
    return (
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <StepWizard step={5} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button onClick={() => setStep(4)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', borderRadius: '999px', border: '1px solid var(--a-border)', background: 'white', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
                    <ArrowLeft size={14} /> กลับไปเลือกเวลา
                </button>
            </div>

            {/* Cart items */}
            <div className="admin-card" style={{ padding: '16px', marginBottom: '16px' }}>
                <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '10px' }}>📋 รายการจอง ({cart.length})</h3>
                {cart.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < cart.length - 1 ? '1px solid var(--a-border)' : 'none', fontSize: '14px' }}>
                        <div>
                            <strong>{item.courtName}</strong>
                            <div style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>{formatDateTH(item.date)} · {item.startTime}–{item.endTime}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: 700, fontFamily: "'Inter'" }}>฿{item.price.toLocaleString()}</span>
                            <button onClick={() => setCart(cart.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e17055', padding: '4px' }}><Trash2 size={14} /></button>
                        </div>
                    </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '2px solid var(--a-border)', fontWeight: 700, fontSize: '16px' }}>
                    <span>ยอดรวม</span>
                    <span style={{ fontFamily: "'Inter'", color: 'var(--a-primary)' }}>฿{cart.reduce((s, i) => s + i.price, 0).toLocaleString()}</span>
                </div>
            </div>

            {/* Participants */}
            <div className="admin-card" style={{ padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '15px' }}>👥 ผู้เรียน ({participants.length} คน)</h3>
                    <button onClick={() => setParticipants(prev => [...prev, { name: '', sportType: '', phone: '' }])} style={{ fontSize: '13px', padding: '4px 14px', borderRadius: '6px', border: '1px solid var(--a-primary)', background: 'var(--a-primary-light)', color: 'var(--a-primary)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Plus size={14} /> เพิ่มผู้เรียน
                    </button>
                </div>
                {participants.map((p, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 30px', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
                        <input className="admin-input" placeholder="ชื่อ" value={p.name} onChange={e => { const np = [...participants]; np[i].name = e.target.value; setParticipants(np) }} style={{ fontSize: '13px' }} />
                        <select className="admin-input" value={p.sportType} onChange={e => { const np = [...participants]; np[i].sportType = e.target.value; setParticipants(np) }} style={{ fontSize: '13px' }}>
                            <option value="">ประเภท</option>
                            <option value="สกี้">⛷️ สกี้</option>
                            <option value="สโนว์บอร์ด">🏂 สโนว์บอร์ด</option>
                        </select>
                        <input className="admin-input" placeholder="เบอร์โทร" value={p.phone} onChange={e => { const np = [...participants]; np[i].phone = e.target.value; setParticipants(np) }} style={{ fontSize: '13px' }} />
                        {participants.length > 1 && <button onClick={() => setParticipants(participants.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e17055', fontSize: '16px', padding: 0 }}>✕</button>}
                    </div>
                ))}
            </div>

            {/* Payment Status */}
            <div className="admin-card" style={{ padding: '16px', marginBottom: '16px' }}>
                <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '10px' }}>สถานะการชำระ</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setBookStatus('CONFIRMED')} style={{
                        flex: 1, padding: '12px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        border: bookStatus === 'CONFIRMED' ? '2px solid #27ae60' : '1px solid var(--a-border)',
                        background: bookStatus === 'CONFIRMED' ? '#e8f5e9' : 'white', color: bookStatus === 'CONFIRMED' ? '#27ae60' : 'var(--a-text)',
                    }}>✅ จ่ายแล้ว</button>
                    <button onClick={() => setBookStatus('PENDING')} style={{
                        flex: 1, padding: '12px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        border: bookStatus === 'PENDING' ? '2px solid #f5a623' : '1px solid var(--a-border)',
                        background: bookStatus === 'PENDING' ? '#fff8e1' : 'white', color: bookStatus === 'PENDING' ? '#f5a623' : 'var(--a-text)',
                    }}>🟡 ยังไม่จ่าย</button>
                </div>
            </div>

            {/* Submit */}
            <button onClick={submitBooking} className="btn-admin" disabled={submitting}
                style={{ width: '100%', padding: '16px', fontSize: '17px', fontWeight: 700 }}>
                {submitting ? 'กำลังจอง...' : `ยืนยันการจอง (${cart.length} รายการ)`}
            </button>
        </div>
    )
}
