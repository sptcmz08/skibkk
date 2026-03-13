'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, MapPin, ArrowRight, ArrowLeft, Check, Trash2, ChevronLeft, ChevronRight, Search, Plus, UserPlus } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface Slot {
    startTime: string
    endTime: string
    available: boolean
    price: number
    status: 'available' | 'booked' | 'locked' | 'mine' | 'past'
    lockedByOther: boolean
    secondsLeft: number
}

interface CourtData {
    courtId: string
    courtName: string
    sportType: string | null
    closed: boolean
    slots: Slot[]
}

interface CartItem {
    courtId: string
    courtName: string
    date: string
    startTime: string
    endTime: string
    price: number
}

const SPORT_ICONS: Record<string, string> = {
    'สกี้': '⛷️',
    'สโนบอร์ด': '🏂',
    'ฟุตบอล': '⚽',
    'แบดมินตัน': '🏸',
    'บาสเกตบอล': '🏀',
    'วอลเลย์บอล': '🏐',
    'เทนนิส': '🎾',
    'อื่นๆ': '🏟️',
}

const MONTH_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const DAY_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

// Step wizard — identical to customer page
function StepWizard({ step }: { step: number }) {
    const steps = [
        { num: 1, label: 'เลือกสถานที่' },
        { num: 2, label: 'เลือกวันที่' },
        { num: 3, label: 'เลือกเวลา' },
        { num: 4, label: 'กรอกข้อมูล' },
    ]
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', marginBottom: '36px', flexWrap: 'wrap' }}>
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
                                background: done ? '#27ae60' : active ? '#f5a623' : '#e0e0e0',
                                color: (done || active) ? 'white' : '#999',
                            }}>
                                {done ? <Check size={12} /> : s.num}
                            </div>
                            <span style={{
                                fontSize: '12px', fontWeight: active ? 700 : 500,
                                color: done ? '#27ae60' : active ? 'var(--a-text)' : 'var(--a-text-muted)',
                            }}>{s.label}</span>
                        </div>
                        {i < 3 && <div style={{ width: '12px', height: '1px', background: '#e0e0e0' }} />}
                    </div>
                )
            })}
        </div>
    )
}

// Venue badge (clickable, for breadcrumb)
function VenueBadge({ name, image, onClick }: { name: string; image?: string | null; onClick: () => void }) {
    return (
        <div onClick={onClick} style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 18px', borderRadius: '999px', cursor: 'pointer',
            background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)',
        }}>
            {image ? <img src={image} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} /> : <MapPin size={16} />}
            <span style={{ fontWeight: 700, color: '#f5a623', fontSize: '14px' }}>{name}</span>
            <ArrowLeft size={13} style={{ color: 'var(--a-text-muted)' }} />
            <span style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>เปลี่ยน</span>
        </div>
    )
}

interface Customer { id: string; name: string; email: string; phone: string }

function AdminBookInner() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const dateParam = searchParams.get('date')

    const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
    const [venues, setVenues] = useState<Array<{ id: string; name: string; image: string | null; description: string | null }>>([])
    const [selectedVenue, setSelectedVenue] = useState<{ id: string; name: string; image: string | null } | null>(null)
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
    const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
    const [availability, setAvailability] = useState<CourtData[]>([])
    const [selectedCourt, setSelectedCourt] = useState<string | null>(null)
    const [cart, setCart] = useState<CartItem[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingVenues, setLoadingVenues] = useState(true)
    const [calAvail, setCalAvail] = useState<Record<string, { totalSlots: number; bookedSlots: number; status: string }>>({})
    const [dateInitialized, setDateInitialized] = useState(false)

    // Admin-specific states
    const [customers, setCustomers] = useState<Customer[]>([])
    const [bookSearch, setBookSearch] = useState('')
    const [bookCustomer, setBookCustomer] = useState<Customer | null>(null)
    const [isNewCustomer, setIsNewCustomer] = useState(false)
    const [newBookerName, setNewBookerName] = useState('')
    const [newBookerPhone, setNewBookerPhone] = useState('')
    const [newBookerLineId, setNewBookerLineId] = useState('')
    const [participants, setParticipants] = useState<Array<{ name: string; sportType: string; height: string; weight: string; phone: string; shoeSize: string }>>([{ name: '', sportType: '', height: '', weight: '', phone: '', shoeSize: '' }])
    const [bookStatus, setBookStatus] = useState<'CONFIRMED' | 'PENDING'>('CONFIRMED')
    const [submitting, setSubmitting] = useState(false)
    const [isBookerLearner, setIsBookerLearner] = useState(false)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Customer search — load all immediately, filter as user types
    useEffect(() => {
        if (isNewCustomer) { setCustomers([]); return }
        const t = setTimeout(() => {
            fetch(`/api/users?search=${encodeURIComponent(bookSearch)}&role=CUSTOMER`)
                .then(r => r.json()).then(d => setCustomers(d.users || [])).catch(() => { })
        }, bookSearch ? 200 : 0)
        return () => clearTimeout(t)
    }, [bookSearch, isNewCustomer])

    // Load venues
    useEffect(() => {
        const fetchVenues = async () => {
            setLoadingVenues(true)
            try {
                const res = await fetch('/api/venues', { cache: 'no-store' })
                const data = await res.json()
                if (data.venues) {
                    const active = data.venues.filter((v: any) => v.isActive)
                    setVenues(active)
                    if (active.length === 0) setStep(2)
                }
            } catch { /* ignore */ } finally { setLoadingVenues(false) }
        }
        fetchVenues()
    }, [])

    // Fetch availability when date selected (no session lock for admin)
    const fetchAvailability = useCallback(async (dateStr: string, silent = false) => {
        if (!silent) setLoading(true)
        try {
            const venueParam = selectedVenue ? `&venueId=${selectedVenue.id}` : ''
            const res = await fetch(`/api/availability?date=${dateStr}${venueParam}`, { cache: 'no-store' })
            const data = await res.json()
            if (data.availability) {
                setAvailability(data.availability)
                if (data.availability.length > 0) {
                    setSelectedCourt(c => {
                        const exists = data.availability.find((f: CourtData) => f.courtId === c)
                        return exists ? c : data.availability[0].courtId
                    })
                }
            }
        } catch { if (!silent) toast.error('ไม่สามารถโหลดข้อมูลได้') }
        finally { if (!silent) setLoading(false) }
    }, [selectedVenue])

    // Auto-initialize from URL date param (from calendar page)
    useEffect(() => {
        if (dateParam && !dateInitialized && venues.length > 0) {
            setDateInitialized(true)
            setSelectedDate(dateParam)
            fetchAvailability(dateParam)
            setStep(3)
        }
    }, [dateParam, dateInitialized, venues, fetchAvailability])

    // Fetch calendar availability for month coloring — same API as customer page
    useEffect(() => {
        if (step === 2) {
            const venueParam = selectedVenue ? `&venueId=${selectedVenue.id}` : ''
            fetch(`/api/availability/calendar?year=${viewYear}&month=${viewMonth + 1}${venueParam}`, { cache: 'no-store' })
                .then(r => r.json())
                .then(data => { if (data.availability) setCalAvail(data.availability) })
                .catch(() => { })
        }
    }, [step, viewYear, viewMonth])

    const handleSelectDate = (dateStr: string) => {
        setSelectedDate(dateStr)
        fetchAvailability(dateStr)
        setStep(3)
    }

    const isInCart = (courtId: string, date: string, startTime: string) =>
        cart.some(i => i.courtId === courtId && i.date === date && i.startTime === startTime)

    // Toggle slot — no lock needed for admin, direct add/remove
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

    // Build calendar data for viewMonth/viewYear
    const getDaysInMonth = () => {
        const firstDay = new Date(viewYear, viewMonth, 1)
        const lastDay = new Date(viewYear, viewMonth + 1, 0)
        const startDow = firstDay.getDay()
        const days: (Date | null)[] = []
        for (let i = 0; i < startDow; i++) days.push(null)
        for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(viewYear, viewMonth, d))
        return days
    }

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
        else setViewMonth(m => m - 1)
    }
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
        else setViewMonth(m => m + 1)
    }

    const currentCourt = availability.find(c => c.courtId === selectedCourt)

    const formatDateTH = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00')
        return `${d.getDate()} ${MONTH_TH[d.getMonth()]} ${d.getFullYear() + 543}`
    }

    const hasCustomer = bookCustomer || (isNewCustomer && newBookerName.trim())

    // Submit booking
    const submitBooking = async () => {
        if (!hasCustomer) { toast.error('กรุณากรอกชื่อผู้จอง'); return }
        if (cart.length === 0) { toast.error('กรุณาเลือกเวลา'); return }
        const validParts = participants.filter(p => p.name.trim())
        if (validParts.length === 0) { toast.error('กรุณากรอกชื่อผู้เรียนอย่างน้อย 1 คน'); return }

        // Confirmation popup (Bug 6.7)
        const totalAmount = cart.reduce((sum, i) => sum + i.price, 0)
        const confirmMsg = `ยืนยันการจอง ${cart.length} รายการ\nยอดรวม ฿${totalAmount.toLocaleString()}\n\nต้องการดำเนินการต่อหรือไม่?`
        if (!confirm(confirmMsg)) return

        setSubmitting(true)
        try {
            const body: any = {
                items: cart, totalAmount, isBookerLearner,
                participants: validParts.map((p, i) => ({
                    name: p.name,
                    sportType: p.sportType,
                    height: p.height ? parseFloat(p.height) : null,
                    weight: p.weight ? parseFloat(p.weight) : null,
                    phone: p.phone || null,
                    shoeSize: p.shoeSize || null,
                    isBooker: i === 0,
                })),
                createdByAdmin: true,
            }
            if (bookCustomer) body.userId = bookCustomer.id
            else if (isNewCustomer) { body.guestName = newBookerName.trim(); body.guestPhone = newBookerPhone.trim(); body.guestLineId = newBookerLineId.trim() || null }

            const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            if (res.ok) {
                const data = await res.json()
                await fetch('/api/bookings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: data.booking.id, status: bookStatus }) })
                toast.success(`จองสำเร็จ! (${cart.length} รายการ) — ${bookStatus === 'CONFIRMED' ? 'จ่ายแล้ว' : 'รอชำระ'}`)
                // Redirect to calendar page with the booked date + venue (Bug 6.8)
                const bookedDate = cart[0]?.date || selectedDate
                const venueParam = selectedVenue ? `&venueId=${selectedVenue.id}` : ''
                router.push(`/admin/calendar?date=${bookedDate}${venueParam}`)
            } else {
                const err = await res.json().catch(() => ({}))
                console.error('Booking error:', err)
                toast.error(err.error || 'จองไม่สำเร็จ')
            }
        } catch (e) { console.error('Submit error:', e); toast.error('เกิดข้อผิดพลาด') }
        finally { setSubmitting(false) }
    }

    // ── STEP 1: เลือกสถานที่เรียน ───────────────────────────────────
    if (step === 1) {
        return (
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                <StepWizard step={1} />
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, textAlign: 'center', marginBottom: '8px' }}>เลือกสถานที่เรียน</h2>
                    <p style={{ textAlign: 'center', color: 'var(--a-text-muted)', marginBottom: '40px', fontSize: '14px' }}>เลือกสถานที่ที่ต้องการจอง</p>

                    {loadingVenues ? (
                        <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" /></div>
                    ) : venues.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--a-text-muted)' }}>
                            <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>ยังไม่มีสถานที่เรียน</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                            {venues.map(venue => (
                                <motion.button key={venue.id} whileHover={{ scale: 1.04, y: -3 }} whileTap={{ scale: 0.97 }}
                                    onClick={() => { setSelectedVenue({ id: venue.id, name: venue.name, image: venue.image }); setStep(2) }}
                                    style={{
                                        padding: '0', borderRadius: '20px', cursor: 'pointer', overflow: 'hidden',
                                        border: '2px solid rgba(245,166,35,0.2)', background: '#fff',
                                        color: 'var(--a-text)', fontFamily: 'inherit',
                                        textAlign: 'center', display: 'flex', flexDirection: 'column',
                                    }}>
                                    <div style={{
                                        height: '120px', width: '100%',
                                        background: venue.image ? `url(${venue.image}) center/cover` : 'linear-gradient(135deg, #f5a623 0%, #e8912d 100%)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {!venue.image && <MapPin size={32} style={{ color: 'rgba(255,255,255,0.5)' }} />}
                                    </div>
                                    <div style={{ padding: '12px' }}>
                                        <span style={{ fontSize: '17px', fontWeight: 800 }}>{venue.name}</span>
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>
        )
    }

    // ── STEP 2: เลือกวันที่ ─────────────────────────────────
    if (step === 2) {
        const calDays = getDaysInMonth()
        return (
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                <StepWizard step={2} />
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                    {selectedVenue && <VenueBadge name={selectedVenue.name} image={selectedVenue.image} onClick={() => setStep(1)} />}
                </div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    {/* Month navigation */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <button onClick={prevMonth} style={{ background: '#f5f5f5', border: 'none', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', color: 'var(--a-text)', display: 'flex', alignItems: 'center' }}>
                            <ChevronLeft size={20} />
                        </button>
                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <div style={{ fontSize: '20px', fontWeight: 800 }}>{MONTH_TH[viewMonth]}</div>
                            <div style={{ fontSize: '13px', color: 'var(--a-text-muted)' }}>{viewYear + 543}</div>
                            {(viewMonth !== new Date().getMonth() || viewYear !== new Date().getFullYear()) && (
                                <button onClick={() => { setViewMonth(new Date().getMonth()); setViewYear(new Date().getFullYear()) }}
                                    style={{ marginTop: '4px', padding: '4px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: '#f5a623', color: 'white', border: 'none', cursor: 'pointer' }}>
                                    วันนี้
                                </button>
                            )}
                        </div>
                        <button onClick={nextMonth} style={{ background: '#f5f5f5', border: 'none', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', color: 'var(--a-text)', display: 'flex', alignItems: 'center' }}>
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Day header */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px' }}>
                        {DAY_TH.map(d => (
                            <div key={d} style={{ textAlign: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--a-text-muted)', padding: '6px 0' }}>{d}</div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                        {calDays.map((date, idx) => {
                            if (!date) return <div key={`empty-${idx}`} />
                            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                            const isPast = date < today
                            const isToday = date.getTime() === today.getTime()
                            const isSelected = dateStr === selectedDate
                            const isSun = date.getDay() === 0
                            const isSat = date.getDay() === 6
                            const dayInfo = calAvail[dateStr]
                            const dayStatus = dayInfo?.status || (isPast ? 'past' : 'available')
                            const freeSlots = dayInfo ? dayInfo.totalSlots - dayInfo.bookedSlots : 0
                            const isClosed = dayStatus === 'closed'

                            const statusConfig = dayStatus === 'full'
                                ? { bg: 'rgba(225,112,85,0.12)', border: 'rgba(225,112,85,0.4)', text: 'เต็มแล้ว', color: '#e17055' }
                                : dayStatus === 'almost_full'
                                    ? { bg: 'rgba(245,166,35,0.12)', border: 'rgba(245,166,35,0.4)', text: `เหลือ ${freeSlots} ชม.`, color: '#f5a623' }
                                    : { bg: 'rgba(39,174,96,0.08)', border: 'rgba(39,174,96,0.3)', text: 'ว่าง', color: '#27ae60' }

                            return (
                                <motion.button key={dateStr}
                                    whileHover={!isPast && !isClosed ? { scale: 1.08 } : undefined}
                                    whileTap={!isPast && !isClosed ? { scale: 0.95 } : undefined}
                                    onClick={() => !isPast && !isClosed && handleSelectDate(dateStr)}
                                    disabled={isPast || isClosed}
                                    style={{
                                        borderRadius: '12px', cursor: isPast || isClosed ? 'not-allowed' : 'pointer',
                                        border: isSelected ? '2px solid #f5a623' : isToday ? '2px solid rgba(245,166,35,0.5)' : `1px solid ${!isPast && !isClosed && dayInfo ? statusConfig.border : '#e9ecef'}`,
                                        background: isSelected ? 'rgba(245,166,35,0.2)' : isPast ? '#f8f8f8' : isClosed ? 'rgba(225,112,85,0.04)' : dayInfo ? statusConfig.bg : '#fff',
                                        color: isPast ? '#b2bec3' : isClosed ? '#b2bec3' : isSelected ? 'var(--a-text)' : isSun ? '#e17055' : isSat ? '#6c5ce7' : 'var(--a-text)',
                                        fontWeight: isSelected || isToday ? 800 : 600,
                                        fontSize: '15px', fontFamily: "'Inter', sans-serif",
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                                        opacity: isPast ? 0.6 : isClosed ? 0.4 : 1,
                                        position: 'relative', minHeight: '58px', padding: '6px 2px',
                                        textDecoration: isPast ? 'line-through' : 'none',
                                    }}>
                                    {date.getDate()}
                                    {!isPast && !isClosed && dayInfo && (
                                        <span style={{ fontSize: '9px', fontWeight: 700, color: statusConfig.color, lineHeight: 1, whiteSpace: 'nowrap' }}>
                                            {statusConfig.text}
                                        </span>
                                    )}
                                    {isClosed && <span style={{ fontSize: '9px', color: '#e17055', fontWeight: 700 }}>ปิด</span>}
                                    {isPast && <span style={{ fontSize: '8px', color: '#b2bec3' }}>ผ่านแล้ว</span>}
                                </motion.button>
                            )
                        })}
                    </div>

                    {/* Status legend */}
                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
                        {[
                            { color: '#27ae60', label: 'ว่าง' },
                            { color: '#f5a623', label: 'ใกล้เต็ม' },
                            { color: '#e17055', label: 'เต็ม' },
                            { color: '#b2bec3', label: 'ผ่านแล้ว' },
                        ].map(s => (
                            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--a-text-muted)' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color, display: 'block' }} />
                                {s.label}
                            </div>
                        ))}
                    </div>

                    <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--a-text-muted)', marginTop: '12px' }}>
                        <Calendar size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
                        เลือกวันที่ต้องการจอง
                    </p>
                </motion.div>
            </div>
        )
    }

    // ── STEP 3: เลือกเวลา ─────────────────────────────────
    if (step === 3) {
        return (
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <StepWizard step={3} />

                {/* Breadcrumb badges */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '28px', flexWrap: 'wrap' }}>
                    {selectedVenue && <VenueBadge name={selectedVenue.name} image={selectedVenue.image} onClick={() => setStep(1)} />}
                    {selectedDate && (
                        <div onClick={() => setStep(2)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '8px 18px', borderRadius: '999px', cursor: 'pointer',
                            background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.25)',
                        }}>
                            <Calendar size={14} style={{ color: '#27ae60' }} />
                            <span style={{ fontWeight: 700, color: '#27ae60', fontSize: '14px' }}>{formatDateTH(selectedDate)}</span>
                            <ArrowLeft size={13} style={{ color: 'var(--a-text-muted)' }} />
                            <span style={{ fontSize: '12px', color: 'var(--a-text-muted)' }}>เปลี่ยน</span>
                        </div>
                    )}
                </div>

                {/* Court tabs */}
                {availability.length > 1 && (
                    <div style={{ marginBottom: '28px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--a-text-muted)' }}>
                            <MapPin size={16} style={{ color: '#f5a623' }} /> เลือกสนาม
                        </h3>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {availability.map(court => {
                                const active = selectedCourt === court.courtId
                                return (
                                    <button key={court.courtId} onClick={() => setSelectedCourt(court.courtId)} style={{
                                        padding: '11px 26px', borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
                                        border: active ? '2px solid #f5a623' : '2px solid #e9ecef',
                                        background: active ? 'rgba(245,166,35,0.12)' : '#fafafa',
                                        color: active ? '#f5a623' : 'var(--a-text-muted)',
                                        fontWeight: 700, fontSize: '14px',
                                    }}>
                                        {court.courtName}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Time slots */}
                <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={18} style={{ color: '#f5a623' }} /> เลือกช่วงเวลา
                        {currentCourt && availability.length === 1 && (
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--a-text-muted)' }}>— {currentCourt.courtName}</span>
                        )}
                    </h3>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" /></div>
                    ) : !currentCourt || currentCourt.closed || currentCourt.slots.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--a-text-muted)' }}>
                            <Clock size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                            <p style={{ fontSize: '15px', fontWeight: 600 }}>ไม่มีเวลาว่างในวันนี้</p>
                            <button onClick={() => setStep(2)} style={{ marginTop: '16px', background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: '10px', padding: '10px 24px', cursor: 'pointer', color: '#f5a623', fontFamily: 'inherit', fontWeight: 600 }}>
                                เลือกวันอื่น
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '10px' }}>
                            {currentCourt.slots.map(slot => {
                                const inCart = selectedDate ? isInCart(currentCourt.courtId, selectedDate, slot.startTime) : false
                                const isPast = slot.status === 'past'
                                const isBooked = !slot.available && !inCart
                                const isDisabled = isBooked || isPast

                                return (
                                    <motion.button key={slot.startTime}
                                        whileHover={!isDisabled ? { scale: 1.04 } : undefined}
                                        whileTap={!isDisabled ? { scale: 0.96 } : undefined}
                                        onClick={() => !isDisabled && toggleSlot(currentCourt, slot)}
                                        disabled={isDisabled}
                                        style={{
                                            padding: '14px 8px', borderRadius: '12px',
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            border: inCart ? '2px solid #f5a623' : isPast ? '2px solid #eee' : isBooked ? '2px solid #eee' : '2px solid #e9ecef',
                                            background: inCart ? 'rgba(245,166,35,0.15)' : isPast ? '#f8f8f8' : isBooked ? 'rgba(225,112,85,0.04)' : '#fff',
                                            color: isPast ? '#b2bec3' : isBooked ? 'var(--a-text-muted)' : inCart ? '#f5a623' : 'var(--a-text)',
                                            fontFamily: "'Inter', sans-serif", textAlign: 'center',
                                            opacity: isBooked ? 0.35 : isPast ? 0.5 : 1, transition: 'all 0.15s',
                                            textDecoration: isPast ? 'line-through' : 'none',
                                        }}>
                                        <div style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.3px' }}>
                                            {slot.startTime}–{slot.endTime}
                                        </div>
                                        {isPast && <div style={{ fontSize: '10px', marginTop: '5px', color: '#e17055', fontWeight: 700 }}>⛔ เลยเวลา</div>}
                                        {isBooked && !isPast && <div style={{ fontSize: '10px', marginTop: '5px', color: 'var(--a-text-muted)' }}>จองแล้ว</div>}
                                        {inCart && !isPast && <div style={{ fontSize: '10px', marginTop: '5px', color: '#f5a623', fontWeight: 700 }}>✓ เลือกแล้ว</div>}
                                        {!isBooked && !inCart && !isPast && (
                                            <div style={{ fontSize: '11px', marginTop: '5px', color: 'var(--a-text-muted)' }}>
                                                ฿{slot.price.toLocaleString()}
                                            </div>
                                        )}
                                    </motion.button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Floating action button — go to step 4 */}
                {cart.length > 0 && (
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50 }}>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => setStep(4)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '14px 24px', borderRadius: '999px',
                                background: 'linear-gradient(135deg, #f5a623 0%, #e6951a 100%)',
                                color: 'white', border: 'none', cursor: 'pointer',
                                boxShadow: '0 8px 30px rgba(245,166,35,0.4)',
                                fontFamily: 'inherit', fontWeight: 700, fontSize: '15px',
                            }}>
                            <span>{cart.length} รายการ</span>
                            <span style={{ fontFamily: "'Inter'", fontWeight: 800 }}>
                                ฿{cart.reduce((s, i) => s + i.price, 0).toLocaleString()}
                            </span>
                            <ArrowRight size={16} />
                        </motion.button>
                    </motion.div>
                )}
            </div>
        )
    }

    // ── STEP 4: กรอกข้อมูลผู้จอง + ผู้เรียน + ยืนยัน ─────────────────
    const total = cart.reduce((s, i) => s + i.price, 0)
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <StepWizard step={4} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                {/* Back to step 3 */}
                <button onClick={() => setStep(3)} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0',
                    color: 'var(--a-text-muted)', fontSize: '14px', fontWeight: 600, marginBottom: '20px', fontFamily: 'inherit',
                }}>
                    <ArrowLeft size={16} /> ย้อนกลับ
                </button>

                <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '28px' }}>กรอกข้อมูลและยืนยัน</h2>

                {/* Cart summary */}
                <div className="admin-card" style={{ padding: '20px', marginBottom: '16px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '12px' }}>📋 รายการจอง ({cart.length})</h3>
                    {cart.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < cart.length - 1 ? '1px solid var(--a-border)' : 'none' }}>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={13} /> {item.courtName}</div>
                                <div style={{ fontSize: '13px', color: 'var(--a-text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                    <Calendar size={12} /> {formatDateTH(item.date)} · <Clock size={12} /> {item.startTime}–{item.endTime}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontWeight: 800, fontFamily: "'Inter'" }}>฿{item.price.toLocaleString()}</span>
                                <button onClick={() => setCart(cart.filter((_, j) => j !== i))} style={{ background: 'rgba(225,112,85,0.08)', border: '1px solid rgba(225,112,85,0.2)', borderRadius: '6px', padding: '4px', cursor: 'pointer', color: '#e17055' }}><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '2px solid var(--a-border)', fontWeight: 800, fontSize: '18px' }}>
                        <span>ยอดรวม</span>
                        <span style={{ fontFamily: "'Inter'", color: '#f5a623' }}>฿{total.toLocaleString()}</span>
                    </div>
                </div>

                {/* Customer */}
                <div className="admin-card" style={{ padding: '20px', marginBottom: '16px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '12px' }}>👤 ผู้จอง</h3>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <button onClick={() => { setIsNewCustomer(false); setNewBookerName(''); setNewBookerPhone('') }}
                            style={{ flex: 1, padding: '8px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', border: !isNewCustomer ? '2px solid #f5a623' : '1px solid var(--a-border)', background: !isNewCustomer ? 'rgba(245,166,35,0.08)' : 'white', color: !isNewCustomer ? '#f5a623' : 'var(--a-text)' }}>
                            🔍 ลูกค้าเดิม
                        </button>
                        <button onClick={() => { setIsNewCustomer(true); setBookCustomer(null); setBookSearch(''); setCustomers([]) }}
                            style={{ flex: 1, padding: '8px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', border: isNewCustomer ? '2px solid #f5a623' : '1px solid var(--a-border)', background: isNewCustomer ? 'rgba(245,166,35,0.08)' : 'white', color: isNewCustomer ? '#f5a623' : 'var(--a-text)' }}>
                            ✏️ กรอกชื่อใหม่
                        </button>
                    </div>
                    {!isNewCustomer ? (
                        <>
                            <div style={{ position: 'relative', marginBottom: '8px' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--a-text-muted)' }} />
                                <input className="admin-input" style={{ paddingLeft: '36px' }} placeholder="พิมพ์ชื่อ / เบอร์โทร / อีเมล" value={bookSearch} onChange={e => { setBookSearch(e.target.value); if (bookCustomer) setBookCustomer(null) }} />
                            </div>
                            {customers.length > 0 && !bookCustomer && (
                                <div style={{ border: '1px solid var(--a-border)', borderRadius: '8px', maxHeight: '150px', overflow: 'auto' }}>
                                    {customers.map(c => (
                                        <button key={c.id} onClick={() => {
                                            setBookCustomer(c); setBookSearch(c.name); setCustomers([])
                                            if (isBookerLearner) {
                                                setParticipants(prev => { const np = [...prev]; np[0] = { ...np[0], name: c.name, phone: c.phone || '' }; return np })
                                            }
                                        }}
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
                        <><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                            <input className="admin-input" placeholder="ชื่อผู้จอง *" value={newBookerName} onChange={e => setNewBookerName(e.target.value)} />
                            <input className="admin-input" placeholder="เบอร์โทร" value={newBookerPhone} onChange={e => setNewBookerPhone(e.target.value)} />
                        </div>
                        <div>
                            <input className="admin-input" placeholder="Line ID (ถ้ามี)" value={newBookerLineId} onChange={e => setNewBookerLineId(e.target.value)} />
                        </div></>
                    )}
                </div>

                {/* Booker is also learner checkbox */}
                <div className="admin-card" style={{ padding: '14px 20px', marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                        <input type="checkbox" checked={isBookerLearner} onChange={e => {
                            const checked = e.target.checked
                            setIsBookerLearner(checked)
                            if (checked) {
                                const name = bookCustomer?.name || newBookerName.trim()
                                const phone = bookCustomer?.phone || newBookerPhone.trim()
                                if (name) {
                                    setParticipants(prev => { const np = [...prev]; np[0] = { ...np[0], name, phone: phone || '' }; return np })
                                }
                            } else {
                                setParticipants(prev => { const np = [...prev]; np[0] = { ...np[0], name: '', phone: '' }; return np })
                            }
                        }} style={{ width: '18px', height: '18px', accentColor: '#f5a623', cursor: 'pointer' }} />
                        ผู้จองเป็นผู้เรียนด้วย
                    </label>
                </div>

                {/* Participants */}
                <div className="admin-card" style={{ padding: '20px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '15px' }}>👥 ผู้เรียน ({participants.length} คน)</h3>
                        <button onClick={() => setParticipants(prev => [...prev, { name: '', sportType: '', height: '', weight: '', phone: '', shoeSize: '' }])}
                            style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '6px', border: '1px solid #f5a623', background: 'rgba(245,166,35,0.08)', color: '#f5a623', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Plus size={13} /> เพิ่ม
                        </button>
                    </div>
                    {participants.map((p, i) => (
                        <div key={i} style={{ border: '1px solid var(--a-border)', borderRadius: '10px', padding: '12px', marginBottom: '10px', position: 'relative' }}>
                            {participants.length > 1 && (
                                <button onClick={() => setParticipants(participants.filter((_, j) => j !== i))} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#e17055', fontSize: '13px', fontWeight: 600 }}>✕</button>
                            )}
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--a-text-muted)', marginBottom: '8px' }}>ผู้เรียนคนที่ {i + 1}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                                <input className="admin-input" placeholder="ชื่อ-นามสกุล *" value={p.name} onChange={e => { const np = [...participants]; np[i].name = e.target.value; setParticipants(np) }} style={{ fontSize: '13px' }} />
                                <select className="admin-input" value={p.sportType} onChange={e => { const np = [...participants]; np[i].sportType = e.target.value; setParticipants(np) }} style={{ fontSize: '13px' }}>
                                    <option value="">ประเภทกีฬา</option>
                                    <option value="สกี้">⛷️ สกี้</option>
                                    <option value="สโนว์บอร์ด">🏂 สโนว์บอร์ด</option>
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
                                <input className="admin-input" placeholder="ส่วนสูง (ซม.)" value={p.height} onChange={e => { const np = [...participants]; np[i].height = e.target.value; setParticipants(np) }} style={{ fontSize: '13px' }} />
                                <input className="admin-input" placeholder="น้ำหนัก (กก.)" value={p.weight} onChange={e => { const np = [...participants]; np[i].weight = e.target.value; setParticipants(np) }} style={{ fontSize: '13px' }} />
                                <input className="admin-input" placeholder="ไซส์รองเท้า (EU)" value={p.shoeSize} onChange={e => { const np = [...participants]; np[i].shoeSize = e.target.value; setParticipants(np) }} style={{ fontSize: '13px' }} />
                                <input className="admin-input" placeholder="เบอร์โทร" value={p.phone} onChange={e => { const np = [...participants]; np[i].phone = e.target.value; setParticipants(np) }} style={{ fontSize: '13px' }} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Payment Status */}
                <div className="admin-card" style={{ padding: '20px', marginBottom: '16px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '10px' }}>สถานะการชำระ</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setBookStatus('CONFIRMED')} style={{
                            flex: 1, padding: '12px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
                            border: bookStatus === 'CONFIRMED' ? '2px solid #27ae60' : '1px solid var(--a-border)',
                            background: bookStatus === 'CONFIRMED' ? '#e8f5e9' : 'white', color: bookStatus === 'CONFIRMED' ? '#27ae60' : 'var(--a-text)',
                        }}>✅ จ่ายแล้ว</button>
                        <button onClick={() => setBookStatus('PENDING')} style={{
                            flex: 1, padding: '12px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
                            border: bookStatus === 'PENDING' ? '2px solid #f5a623' : '1px solid var(--a-border)',
                            background: bookStatus === 'PENDING' ? '#fff8e1' : 'white', color: bookStatus === 'PENDING' ? '#f5a623' : 'var(--a-text)',
                        }}>🟡 ยังไม่จ่าย</button>
                    </div>
                </div>

                {/* Submit */}
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={submitBooking} disabled={submitting || !hasCustomer}
                    className="btn-admin"
                    style={{ width: '100%', padding: '16px', fontSize: '17px', fontWeight: 700, marginBottom: '40px' }}>
                    {submitting ? 'กำลังจอง...' : `ยืนยันการจอง (${cart.length} รายการ · ฿${total.toLocaleString()})`}
                </motion.button>
            </motion.div>
        </div>
    )
}

export default function AdminBookPage() {
    return (
        <Suspense fallback={<div style={{ textAlign: 'center', padding: '60px' }}>กำลังโหลด...</div>}>
            <AdminBookInner />
        </Suspense>
    )
}
