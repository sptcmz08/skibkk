'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight, Search, UserPlus, Plus, Trash2, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface Slot { startTime: string; endTime: string; available: boolean; price: number; status: string }
interface CourtData { courtId: string; courtName: string; sportType: string | null; closed: boolean; slots: Slot[] }
interface Customer { id: string; name: string; email: string; phone: string }

const MONTH_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const DAY_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const SPORT_ICONS: Record<string, string> = { 'สกี้': '⛷️', 'สโนว์บอร์ด': '🏂', 'ฟุตบอล': '⚽', 'แบดมินตัน': '🏸', 'บาสเกตบอล': '🏀' }

export default function AdminBookPage() {
    // Refs for scrolling
    const sportRef = useRef<HTMLDivElement>(null)
    const calRef = useRef<HTMLDivElement>(null)
    const timeRef = useRef<HTMLDivElement>(null)
    const participantRef = useRef<HTMLDivElement>(null)
    const confirmRef = useRef<HTMLDivElement>(null)

    const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
        setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }

    // Customer
    const [customers, setCustomers] = useState<Customer[]>([])
    const [bookSearch, setBookSearch] = useState('')
    const [bookCustomer, setBookCustomer] = useState<Customer | null>(null)
    const [isNewCustomer, setIsNewCustomer] = useState(false)
    const [newBookerName, setNewBookerName] = useState('')
    const [newBookerPhone, setNewBookerPhone] = useState('')

    // Sport Type
    const [sportTypes, setSportTypes] = useState<Array<{ name: string; icon: string; color: string }>>([])
    const [selectedSport, setSelectedSport] = useState<string | null>(null)

    // Calendar
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const [viewYear, setViewYear] = useState(today.getFullYear())
    const [viewMonth, setViewMonth] = useState(today.getMonth())
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [calAvail, setCalAvail] = useState<Record<string, { totalSlots: number; bookedSlots: number; status: string }>>({})

    // Time slots
    const [availability, setAvailability] = useState<CourtData[]>([])
    const [selectedCourt, setSelectedCourt] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [cart, setCart] = useState<Array<{ courtId: string; courtName: string; date: string; startTime: string; endTime: string; price: number }>>([])

    // Participants & Submit
    const [participants, setParticipants] = useState<Array<{ name: string; sportType: string; phone: string }>>([{ name: '', sportType: '', phone: '' }])
    const [bookStatus, setBookStatus] = useState<'CONFIRMED' | 'PENDING'>('CONFIRMED')
    const [submitting, setSubmitting] = useState(false)

    // Customer search
    useEffect(() => {
        if (bookSearch.length < 2 || isNewCustomer) { setCustomers([]); return }
        const t = setTimeout(() => {
            fetch(`/api/users?search=${encodeURIComponent(bookSearch)}&role=USER`)
                .then(r => r.json())
                .then(d => setCustomers(d.users || []))
                .catch(() => { })
        }, 300)
        return () => clearTimeout(t)
    }, [bookSearch, isNewCustomer])

    // Load sport types
    useEffect(() => {
        fetch('/api/sport-types', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => {
                const active = (d.sportTypes || []).filter((s: any) => s.isActive)
                setSportTypes(active)
                // If only 1 sport type, auto-select
                if (active.length === 1) setSelectedSport(active[0].name)
            })
            .catch(() => { })
    }, [])

    // Fetch monthly availability
    useEffect(() => {
        if (!selectedSport) return
        const startDate = new Date(viewYear, viewMonth, 1)
        const endDate = new Date(viewYear, viewMonth + 1, 0)
        const promises: Promise<void>[] = []
        const avail: typeof calAvail = {}

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            promises.push(
                fetch(`/api/availability?date=${dateStr}`, { cache: 'no-store' })
                    .then(r => r.json())
                    .then(data => {
                        const courts = (data.availability || []).filter((c: any) => c.sportType === selectedSport && !c.closed)
                        let total = 0, booked = 0
                        courts.forEach((c: any) => { c.slots?.forEach((s: Slot) => { total++; if (!s.available) booked++ }) })
                        const pct = total > 0 ? booked / total : 0
                        avail[dateStr] = { totalSlots: total, bookedSlots: booked, status: total === 0 ? 'closed' : pct >= 1 ? 'full' : pct >= 0.7 ? 'almost_full' : 'available' }
                    })
                    .catch(() => { })
            )
        }
        Promise.all(promises).then(() => setCalAvail(avail))
    }, [viewYear, viewMonth, selectedSport])

    // Fetch availability for selected date
    const fetchAvailability = useCallback(async (date: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/availability?date=${date}`, { cache: 'no-store' })
            const data = await res.json()
            const courts = (data.availability || []).filter((c: CourtData) => (!selectedSport || c.sportType === selectedSport) && !c.closed)
            setAvailability(courts)
            if (courts.length > 0) setSelectedCourt(courts[0].courtId)
        } catch { setAvailability([]) }
        finally { setLoading(false) }
    }, [selectedSport])

    const handleSelectDate = (dateStr: string) => {
        setSelectedDate(dateStr)
        setCart([])
        fetchAvailability(dateStr)
        scrollTo(timeRef)
    }

    const isInCart = (courtId: string, date: string, startTime: string) =>
        cart.some(i => i.courtId === courtId && i.date === date && i.startTime === startTime)

    const toggleSlot = (court: CourtData, slot: Slot) => {
        if (!selectedDate) return
        if (isInCart(court.courtId, selectedDate, slot.startTime)) {
            setCart(cart.filter(i => !(i.courtId === court.courtId && i.date === selectedDate && i.startTime === slot.startTime)))
        } else {
            setCart([...cart, {
                courtId: court.courtId, courtName: court.courtName,
                date: selectedDate, startTime: slot.startTime, endTime: slot.endTime, price: slot.price,
            }])
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

    const hasCustomer = bookCustomer || (isNewCustomer && newBookerName.trim())

    // Submit booking
    const submitBooking = async () => {
        if (!hasCustomer) { toast.error('กรุณาเลือกหรือกรอกชื่อผู้จอง'); return }
        if (cart.length === 0) { toast.error('กรุณาเลือกเวลา'); return }
        const validParts = participants.filter(p => p.name.trim())
        if (validParts.length === 0) { toast.error('กรุณากรอกชื่อผู้เรียนอย่างน้อย 1 คน'); return }

        setSubmitting(true)
        try {
            const totalAmount = cart.reduce((sum, i) => sum + i.price, 0)
            const body: any = {
                items: cart, totalAmount, isBookerLearner: false,
                participants: validParts.map((p, i) => ({ ...p, isBooker: i === 0 })),
                createdByAdmin: true,
            }
            if (bookCustomer) {
                body.userId = bookCustomer.id
            } else if (isNewCustomer) {
                body.guestName = newBookerName.trim()
                body.guestPhone = newBookerPhone.trim()
            }

            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            if (res.ok) {
                const data = await res.json()
                await fetch('/api/bookings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bookingId: data.booking.id, status: bookStatus }),
                })
                toast.success(`จองสำเร็จ! (${cart.length} รายการ) — ${bookStatus === 'CONFIRMED' ? 'จ่ายแล้ว' : 'รอชำระ'}`)
                // Reset all
                setBookCustomer(null); setBookSearch(''); setIsNewCustomer(false); setNewBookerName(''); setNewBookerPhone('')
                setSelectedDate(null); setCart([]); setAvailability([]); setSelectedCourt(null)
                setParticipants([{ name: '', sportType: '', phone: '' }]); setBookStatus('CONFIRMED')
                window.scrollTo({ top: 0, behavior: 'smooth' })
            } else {
                const err = await res.json().catch(() => ({}))
                toast.error(err.error || 'จองไม่สำเร็จ')
            }
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setSubmitting(false) }
    }

    const calDays = getDaysInMonth()

    // ── SINGLE PAGE FLOW ──
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserPlus size={24} style={{ color: 'var(--a-primary)' }} /> จองให้ลูกค้า
            </h1>
            <p style={{ color: 'var(--a-text-muted)', fontSize: '14px', marginBottom: '24px' }}>กรอกข้อมูลเรียงตามลำดับ ระบบจะเลื่อนไปส่วนถัดไปอัตโนมัติ</p>

            {/* ════════ SECTION 1: ผู้จอง ════════ */}
            <div className="admin-card" style={{ padding: '20px', marginBottom: '16px' }}>
                <h3 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: hasCustomer ? '#27ae60' : 'var(--a-primary)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>
                        {hasCustomer ? <Check size={14} /> : '1'}
                    </span>
                    ผู้จอง
                </h3>

                {/* Toggle: existing vs new */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button onClick={() => { setIsNewCustomer(false); setNewBookerName(''); setNewBookerPhone('') }}
                        style={{ flex: 1, padding: '10px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s', border: !isNewCustomer ? '2px solid var(--a-primary)' : '1px solid var(--a-border)', background: !isNewCustomer ? 'var(--a-primary-light)' : 'white', color: !isNewCustomer ? 'var(--a-primary)' : 'var(--a-text)' }}>
                        🔍 ค้นหาลูกค้าเดิม
                    </button>
                    <button onClick={() => { setIsNewCustomer(true); setBookCustomer(null); setBookSearch(''); setCustomers([]) }}
                        style={{ flex: 1, padding: '10px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s', border: isNewCustomer ? '2px solid var(--a-primary)' : '1px solid var(--a-border)', background: isNewCustomer ? 'var(--a-primary-light)' : 'white', color: isNewCustomer ? 'var(--a-primary)' : 'var(--a-text)' }}>
                        ✏️ ลูกค้าใหม่ / จองให้คนอื่น
                    </button>
                </div>

                {!isNewCustomer ? (
                    <>
                        <div style={{ position: 'relative', marginBottom: '8px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--a-text-muted)' }} />
                            <input className="admin-input" style={{ paddingLeft: '36px' }} placeholder="พิมพ์ชื่อ / เบอร์โทร / อีเมล" value={bookSearch}
                                onChange={e => { setBookSearch(e.target.value); if (bookCustomer) setBookCustomer(null) }} />
                        </div>
                        {customers.length > 0 && !bookCustomer && (
                            <div style={{ border: '1px solid var(--a-border)', borderRadius: '8px', maxHeight: '180px', overflow: 'auto', marginBottom: '8px' }}>
                                {customers.map(c => (
                                    <button key={c.id} onClick={() => { setBookCustomer(c); setBookSearch(c.name); setCustomers([]); scrollTo(sportRef) }}
                                        style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid var(--a-border)', fontSize: '14px', fontFamily: 'inherit' }}>
                                        <strong>{c.name}</strong> <span style={{ color: 'var(--a-text-muted)' }}>{c.phone}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {bookCustomer && (
                            <div style={{ padding: '10px 14px', background: '#e8f5e9', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>✅ <strong>{bookCustomer.name}</strong> ({bookCustomer.phone})</span>
                                <button onClick={() => { setBookCustomer(null); setBookSearch('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e17055', fontWeight: 600, fontFamily: 'inherit', fontSize: '13px' }}>เปลี่ยน</button>
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <input className="admin-input" placeholder="ชื่อผู้จอง *" value={newBookerName}
                            onChange={e => setNewBookerName(e.target.value)} />
                        <input className="admin-input" placeholder="เบอร์โทร" value={newBookerPhone}
                            onChange={e => setNewBookerPhone(e.target.value)} />
                        {newBookerName.trim() && (
                            <div style={{ gridColumn: '1 / -1', padding: '8px 14px', background: '#e8f5e9', borderRadius: '8px', fontSize: '13px' }}>
                                ✅ ผู้จอง: <strong>{newBookerName.trim()}</strong> {newBookerPhone && `(${newBookerPhone})`}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ════════ SECTION 2: ประเภทกีฬา ════════ */}
            {hasCustomer && (
                <div ref={sportRef} className="admin-card" style={{ padding: '20px', marginBottom: '16px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: selectedSport ? '#27ae60' : 'var(--a-primary)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>
                            {selectedSport ? <Check size={14} /> : '2'}
                        </span>
                        เลือกประเภทกีฬา
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                        {sportTypes.map(st => {
                            const active = selectedSport === st.name
                            return (
                                <button key={st.name} onClick={() => { setSelectedSport(st.name); scrollTo(calRef) }}
                                    style={{
                                        padding: '20px 12px', borderRadius: '12px', cursor: 'pointer',
                                        border: active ? `2px solid ${st.color}` : `1px solid ${st.color}33`,
                                        background: active ? `${st.color}15` : `${st.color}05`,
                                        color: 'var(--a-text)', fontFamily: 'inherit', textAlign: 'center',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                        transition: 'all 0.15s',
                                    }}>
                                    <span style={{ fontSize: '32px', lineHeight: 1 }}>{st.icon || SPORT_ICONS[st.name] || '🏟️'}</span>
                                    <span style={{ fontSize: '14px', fontWeight: 700 }}>{st.name}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ════════ SECTION 3: ปฏิทิน ════════ */}
            {hasCustomer && selectedSport && (
                <div ref={calRef} className="admin-card" style={{ padding: '20px', marginBottom: '16px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: selectedDate ? '#27ae60' : 'var(--a-primary)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>
                            {selectedDate ? <Check size={14} /> : '3'}
                        </span>
                        เลือกวันที่
                        {selectedDate && <span style={{ fontSize: '13px', fontWeight: 500, color: '#27ae60' }}>— {formatDateTH(selectedDate)}</span>}
                    </h3>

                    {/* Month nav */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <button onClick={prevMonth} className="btn-admin-outline" style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
                        <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '16px', fontWeight: 800 }}>{MONTH_TH[viewMonth]}</span>
                            <span style={{ fontSize: '13px', color: 'var(--a-text-muted)', marginLeft: '6px' }}>{viewYear + 543}</span>
                        </div>
                        <button onClick={nextMonth} className="btn-admin-outline" style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
                    </div>

                    {/* Day headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
                        {DAY_TH.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--a-text-muted)', padding: '4px 0' }}>{d}</div>)}
                    </div>

                    {/* Calendar grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                        {calDays.map((date, idx) => {
                            if (!date) return <div key={`e-${idx}`} />
                            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                            const isPast = dateStr < todayStr
                            const isToday = dateStr === todayStr
                            const isSelected = dateStr === selectedDate
                            const dayInfo = calAvail[dateStr]
                            const dayStatus = dayInfo?.status || (isPast ? 'past' : 'available')
                            const freeSlots = dayInfo ? dayInfo.totalSlots - dayInfo.bookedSlots : 0
                            const isClosed = dayStatus === 'closed'
                            const isSun = date.getDay() === 0
                            const isSat = date.getDay() === 6

                            const sc = dayStatus === 'full'
                                ? { bg: '#fde8e8', border: '#e1705540', text: 'เต็ม', color: '#e17055' }
                                : dayStatus === 'almost_full'
                                    ? { bg: '#fff8e1', border: '#f5a62340', text: `เหลือ ${freeSlots}`, color: '#f5a623' }
                                    : { bg: '#e8f5e9', border: '#27ae6030', text: 'ว่าง', color: '#27ae60' }

                            return (
                                <button key={dateStr} onClick={() => !isPast && !isClosed && handleSelectDate(dateStr)}
                                    disabled={isPast || isClosed}
                                    style={{
                                        borderRadius: '8px', cursor: isPast || isClosed ? 'not-allowed' : 'pointer',
                                        border: isSelected ? '2px solid var(--a-primary)' : isToday ? '2px solid var(--a-primary)' : `1px solid ${!isPast && dayInfo ? sc.border : '#eee'}`,
                                        background: isSelected ? 'var(--a-primary-light)' : isPast ? '#fafafa' : isClosed ? '#fafafa' : dayInfo ? sc.bg : 'white',
                                        color: isPast ? '#bbb' : isSun ? '#e17055' : isSat ? '#6c5ce7' : 'var(--a-text)',
                                        fontWeight: isSelected || isToday ? 800 : 600, fontSize: '13px', fontFamily: 'inherit',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px',
                                        opacity: isPast ? 0.5 : isClosed ? 0.4 : 1, minHeight: '50px', padding: '4px 2px',
                                        textDecoration: isPast ? 'line-through' : 'none', transition: 'all 0.1s',
                                    }}>
                                    {date.getDate()}
                                    {!isPast && !isClosed && dayInfo && <span style={{ fontSize: '8px', fontWeight: 700, color: sc.color, lineHeight: 1 }}>{sc.text}</span>}
                                    {isClosed && <span style={{ fontSize: '8px', color: '#e17055', fontWeight: 700 }}>ปิด</span>}
                                </button>
                            )
                        })}
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                        {[{ color: '#27ae60', label: 'ว่าง' }, { color: '#f5a623', label: 'ใกล้เต็ม' }, { color: '#e17055', label: 'เต็ม' }, { color: '#bbb', label: 'ผ่านแล้ว' }].map(s => (
                            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--a-text-muted)' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />{s.label}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ════════ SECTION 4: เลือกเวลา ════════ */}
            {selectedDate && (
                <div ref={timeRef} className="admin-card" style={{ padding: '20px', marginBottom: '16px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: cart.length > 0 ? '#27ae60' : 'var(--a-primary)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>
                            {cart.length > 0 ? <Check size={14} /> : '4'}
                        </span>
                        เลือกเวลา — {formatDateTH(selectedDate)}
                        {cart.length > 0 && <span style={{ fontSize: '13px', fontWeight: 600, color: '#27ae60' }}>({cart.length} รายการ)</span>}
                    </h3>

                    {/* Court tabs */}
                    {availability.length > 1 && (
                        <div style={{ marginBottom: '14px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--a-text-muted)', marginBottom: '6px' }}>เลือกสนาม:</div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {availability.map(court => {
                                    const active = selectedCourt === court.courtId
                                    return (
                                        <button key={court.courtId} onClick={() => setSelectedCourt(court.courtId)} style={{
                                            padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
                                            border: active ? '2px solid var(--a-primary)' : '1px solid var(--a-border)',
                                            background: active ? 'var(--a-primary-light)' : 'white',
                                            color: active ? 'var(--a-primary)' : 'var(--a-text)',
                                            fontWeight: 700, fontSize: '13px', transition: 'all 0.15s',
                                        }}>{court.courtName}</button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Time slots */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>⏳ กำลังโหลด...</div>
                    ) : !currentCourt || currentCourt.slots.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--a-text-muted)' }}>ไม่มีเวลาว่างในวันนี้</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                            {currentCourt.slots.map(slot => {
                                const inCart = selectedDate ? isInCart(currentCourt.courtId, selectedDate, slot.startTime) : false
                                const isBooked = !slot.available && !inCart
                                const isPast = slot.status === 'past'
                                const isDisabled = isBooked || isPast

                                return (
                                    <button key={slot.startTime} onClick={() => !isDisabled && toggleSlot(currentCourt, slot)}
                                        disabled={isDisabled}
                                        style={{
                                            padding: '12px 6px', borderRadius: '10px',
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            border: inCart ? '2px solid var(--a-primary)' : isBooked ? '1px solid #eee' : '1px solid #c6f6d5',
                                            background: inCart ? 'var(--a-primary-light)' : isPast ? '#f8f8f8' : isBooked ? '#fde8e8' : '#f0fff4',
                                            color: isPast ? '#bbb' : isBooked ? '#ccc' : inCart ? 'var(--a-primary)' : '#27ae60',
                                            fontFamily: "'Inter', sans-serif", textAlign: 'center',
                                            opacity: isBooked ? 0.4 : isPast ? 0.5 : 1, transition: 'all 0.15s',
                                            textDecoration: isPast ? 'line-through' : 'none',
                                        }}>
                                        <div style={{ fontSize: '14px', fontWeight: 700 }}>{slot.startTime}–{slot.endTime}</div>
                                        {isPast && <div style={{ fontSize: '9px', marginTop: '3px', color: '#e17055', fontWeight: 700 }}>เลยเวลา</div>}
                                        {isBooked && !isPast && <div style={{ fontSize: '9px', marginTop: '3px' }}>จองแล้ว</div>}
                                        {inCart && <div style={{ fontSize: '9px', marginTop: '3px', fontWeight: 700 }}>✓ เลือกแล้ว</div>}
                                        {!isBooked && !inCart && !isPast && <div style={{ fontSize: '10px', marginTop: '3px', color: '#999' }}>฿{slot.price.toLocaleString()}</div>}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Next button */}
                    {cart.length > 0 && (
                        <div style={{ marginTop: '14px', padding: '12px 16px', background: '#f0fff4', borderRadius: '10px', border: '1px solid #c6f6d5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontSize: '14px' }}><strong>{cart.length} รายการ</strong> · <strong style={{ color: 'var(--a-primary)' }}>฿{cart.reduce((s, i) => s + i.price, 0).toLocaleString()}</strong></span>
                            <button onClick={() => scrollTo(participantRef)} className="btn-admin" style={{ padding: '8px 20px', fontWeight: 700, fontSize: '14px' }}>ถัดไป ↓</button>
                        </div>
                    )}
                </div>
            )}

            {/* ════════ SECTION 5: ผู้เรียน ════════ */}
            {cart.length > 0 && (
                <div ref={participantRef} className="admin-card" style={{ padding: '20px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--a-primary)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>5</span>
                            ผู้เรียน ({participants.length} คน)
                        </h3>
                        <button onClick={() => setParticipants(prev => [...prev, { name: '', sportType: '', phone: '' }])}
                            style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--a-primary)', background: 'var(--a-primary-light)', color: 'var(--a-primary)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Plus size={13} /> เพิ่ม
                        </button>
                    </div>
                    {participants.map((p, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 28px', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                            <input className="admin-input" placeholder="ชื่อ" value={p.name} onChange={e => { const np = [...participants]; np[i].name = e.target.value; setParticipants(np) }} style={{ fontSize: '13px' }} />
                            <select className="admin-input" value={p.sportType} onChange={e => { const np = [...participants]; np[i].sportType = e.target.value; setParticipants(np) }} style={{ fontSize: '13px' }}>
                                <option value="">ประเภท</option>
                                <option value="สกี้">⛷️ สกี้</option>
                                <option value="สโนว์บอร์ด">🏂 สโนว์บอร์ด</option>
                            </select>
                            <input className="admin-input" placeholder="เบอร์" value={p.phone} onChange={e => { const np = [...participants]; np[i].phone = e.target.value; setParticipants(np) }} style={{ fontSize: '13px' }} />
                            {participants.length > 1 && <button onClick={() => setParticipants(participants.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e17055', fontSize: '14px', padding: 0 }}>✕</button>}
                        </div>
                    ))}
                </div>
            )}

            {/* ════════ SECTION 6: สถานะ + ยืนยัน ════════ */}
            {cart.length > 0 && (
                <div ref={confirmRef} className="admin-card" style={{ padding: '20px', marginBottom: '24px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '12px' }}>สถานะการชำระ</h3>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button onClick={() => setBookStatus('CONFIRMED')} style={{
                            flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                            border: bookStatus === 'CONFIRMED' ? '2px solid #27ae60' : '1px solid var(--a-border)',
                            background: bookStatus === 'CONFIRMED' ? '#e8f5e9' : 'white', color: bookStatus === 'CONFIRMED' ? '#27ae60' : 'var(--a-text)',
                        }}>✅ จ่ายแล้ว</button>
                        <button onClick={() => setBookStatus('PENDING')} style={{
                            flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                            border: bookStatus === 'PENDING' ? '2px solid #f5a623' : '1px solid var(--a-border)',
                            background: bookStatus === 'PENDING' ? '#fff8e1' : 'white', color: bookStatus === 'PENDING' ? '#f5a623' : 'var(--a-text)',
                        }}>🟡 ยังไม่จ่าย</button>
                    </div>

                    {/* Summary */}
                    <div style={{ padding: '14px 16px', background: '#f7f9fc', borderRadius: '10px', marginBottom: '16px', fontSize: '14px' }}>
                        <div style={{ marginBottom: '6px' }}><strong>ผู้จอง:</strong> {bookCustomer?.name || newBookerName}</div>
                        <div style={{ marginBottom: '6px' }}><strong>ประเภท:</strong> {selectedSport}</div>
                        <div style={{ marginBottom: '6px' }}><strong>วันที่:</strong> {selectedDate ? formatDateTH(selectedDate) : ''}</div>
                        <div style={{ marginBottom: '6px' }}><strong>รายการ:</strong> {cart.length} ชั่วโมง</div>
                        {cart.map((item, i) => (
                            <div key={i} style={{ fontSize: '12px', color: 'var(--a-text-muted)', marginLeft: '12px' }}>• {item.courtName} {item.startTime}–{item.endTime} (฿{item.price.toLocaleString()})</div>
                        ))}
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--a-border)', fontWeight: 700, fontSize: '16px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>ยอดรวม</span>
                            <span style={{ color: 'var(--a-primary)' }}>฿{cart.reduce((s, i) => s + i.price, 0).toLocaleString()}</span>
                        </div>
                    </div>

                    <button onClick={submitBooking} className="btn-admin" disabled={submitting}
                        style={{ width: '100%', padding: '16px', fontSize: '17px', fontWeight: 700 }}>
                        {submitting ? 'กำลังจอง...' : `ยืนยันการจอง (${cart.length} รายการ)`}
                    </button>
                </div>
            )}
        </div>
    )
}
