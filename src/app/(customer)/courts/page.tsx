'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, MapPin, ShoppingCart, ArrowRight, ArrowLeft, Check, Trash2, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { getSessionId } from '@/lib/session'

interface Slot {
    startTime: string
    endTime: string
    available: boolean
    price: number
    status: 'available' | 'booked' | 'locked' | 'mine'
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

// Step wizard
function StepWizard({ step }: { step: 1 | 2 | 3 }) {
    const steps = [
        { num: 1, label: 'เลือกสถานที่' },
        { num: 2, label: 'เลือกวันที่' },
        { num: 3, label: 'เลือกเวลา' },
        { num: 4, label: 'กรอกข้อมูล' },
        { num: 5, label: 'ชำระเงิน' },
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
                            background: done ? 'rgba(16,185,129,0.08)' : active ? 'rgba(245,166,35,0.12)' : 'transparent',
                        }}>
                            <div style={{
                                width: '24px', height: '24px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '11px', fontWeight: 700, flexShrink: 0,
                                background: done ? '#10b981' : active ? 'var(--c-primary)' : 'rgba(255,255,255,0.08)',
                                color: (done || active) ? 'white' : 'var(--c-text-muted)',
                            }}>
                                {done ? <Check size={12} /> : s.num}
                            </div>
                            <span style={{
                                fontSize: '12px', fontWeight: active ? 700 : 500,
                                color: done ? '#10b981' : active ? 'var(--c-text)' : 'var(--c-text-muted)',
                            }}>{s.label}</span>
                        </div>
                        {i < 4 && <div style={{ width: '12px', height: '1px', background: 'rgba(255,255,255,0.08)' }} />}
                    </div>
                )
            })}
        </div>
    )
}

// Venue badge clickable
function VenueBadge({ name, image, onClick }: { name: string; image?: string | null; onClick: () => void }) {
    return (
        <div onClick={onClick} style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 18px', borderRadius: '999px', cursor: 'pointer',
            background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.25)',
        }}>
            {image ? <img src={image} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} /> : <MapPin size={16} />}
            <span style={{ fontWeight: 700, color: 'var(--c-primary-light)', fontSize: '14px' }}>{name}</span>
            <ArrowLeft size={13} style={{ color: 'var(--c-text-muted)' }} />
            <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>เปลี่ยน</span>
        </div>
    )
}

export default function CourtsPage() {
    const router = useRouter()
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [venues, setVenues] = useState<Array<{ id: string; name: string; image: string | null; description: string | null }>>([])
    const [selectedVenue, setSelectedVenue] = useState<{ id: string; name: string; image: string | null } | null>(null)
    const [allCourts, setAllCourts] = useState<CourtData[]>([])
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
    const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
    const [availability, setAvailability] = useState<CourtData[]>([])
    const [selectedCourt, setSelectedCourt] = useState<string | null>(null)
    const [cart, setCart] = useState<CartItem[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingVenues, setLoadingVenues] = useState(true)
    const pollRef = useRef<NodeJS.Timeout | null>(null)
    const [calAvail, setCalAvail] = useState<Record<string, { totalSlots: number; bookedSlots: number; status: string }>>({})
    const [maxBookingHours, setMaxBookingHours] = useState(0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get current Bangkok time for disabling past slots
    const getNowBangkok = () => {
        const now = new Date()
        const bkk = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
        return { hour: bkk.getHours(), minute: bkk.getMinutes(), dateStr: `${bkk.getFullYear()}-${String(bkk.getMonth() + 1).padStart(2, '0')}-${String(bkk.getDate()).padStart(2, '0')}` }
    }

    const isSlotPast = (dateStr: string, startTime: string) => {
        const bkk = getNowBangkok()
        if (dateStr !== bkk.dateStr) return false
        const [h, m] = startTime.split(':').map(Number)
        return h < bkk.hour || (h === bkk.hour && m <= bkk.minute)
    }

    // Load cart
    useEffect(() => {
        const saved = localStorage.getItem('skibkk-cart')
        if (saved) { try { setCart(JSON.parse(saved)) } catch { /* ignore */ } }
        // Load max booking hours setting
        fetch('/api/settings', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => { if (data.max_booking_hours) setMaxBookingHours(parseInt(data.max_booking_hours) || 0) })
            .catch(() => { })
    }, [])

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
                    if (active.length === 0) setStep(2) // skip step 1 if no venues
                }
            } catch { /* ignore */ } finally { setLoadingVenues(false) }
        }
        fetchVenues()
    }, [])

    const updateCart = (newCart: CartItem[]) => {
        setCart(newCart)
        localStorage.setItem('skibkk-cart', JSON.stringify(newCart))
        window.dispatchEvent(new Event('cart-updated'))
    }

    // Fetch availability when date selected
    const fetchAvailability = useCallback(async (dateStr: string, silent = false) => {
        if (!silent) setLoading(true)
        try {
            const sessionId = getSessionId()
            const venueParam = selectedVenue ? `&venueId=${selectedVenue.id}` : ''
            const res = await fetch(`/api/availability?date=${dateStr}&sessionId=${sessionId}${venueParam}`, { cache: 'no-store' })
            const data = await res.json()
            if (data.availability) {
                setAllCourts(data.availability)
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

    // Poll availability every 5s when on step 3
    useEffect(() => {
        if (step === 3 && selectedDate) {
            pollRef.current = setInterval(() => fetchAvailability(selectedDate, true), 5000)
        }
        return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }, [step, selectedDate, fetchAvailability])

    // Fetch calendar availability for month coloring
    useEffect(() => {
        if (step === 2) {
            const venueParam = selectedVenue ? `&venueId=${selectedVenue.id}` : ''
            fetch(`/api/availability/calendar?year=${viewYear}&month=${viewMonth + 1}${venueParam}`, { cache: 'no-store' })
                .then(r => r.json())
                .then(data => { if (data.availability) setCalAvail(data.availability) })
                .catch(() => { })
        }
    }, [step, viewYear, viewMonth, selectedVenue])

    const handleSelectDate = (dateStr: string) => {
        setSelectedDate(dateStr)
        fetchAvailability(dateStr)
        setStep(3)
    }

    const isInCart = (courtId: string, date: string, startTime: string) =>
        cart.some(i => i.courtId === courtId && i.date === date && i.startTime === startTime)

    const toggleSlot = async (court: CourtData, slot: Slot) => {
        if (!selectedDate) return
        if (isSlotPast(selectedDate, slot.startTime)) {
            toast.error('ไม่สามารถจองเวลาที่ผ่านมาแล้วได้')
            return
        }
        if (isInCart(court.courtId, selectedDate, slot.startTime)) {
            // Remove from cart & release lock
            updateCart(cart.filter(i => !(i.courtId === court.courtId && i.date === selectedDate && i.startTime === slot.startTime)))
            const sessionId = getSessionId()
            fetch('/api/locks', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, slots: [{ courtId: court.courtId, date: selectedDate, startTime: slot.startTime }] }),
            }).catch(() => { })
            toast.success('ลบออกจากตะกร้าแล้ว')
        } else {
            // Check max booking hours limit
            if (maxBookingHours > 0 && cart.length >= maxBookingHours) {
                toast.error(`จองได้สูงสุด ${maxBookingHours} ชั่วโมงต่อการจอง`, { duration: 3000 })
                return
            }
            // Try to lock first
            const sessionId = getSessionId()
            const lockRes = await fetch('/api/locks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, slots: [{ courtId: court.courtId, date: selectedDate, startTime: slot.startTime }] }),
            })
            const lockData = await lockRes.json()
            const result = lockData.results?.[0]

            if (result?.success === false && result?.reason === 'locked_by_other') {
                const m = Math.floor(result.secondsLeft / 60)
                const s = result.secondsLeft % 60
                toast.error(`สล็อตนี้ถูก Lock โดยคนอื่น (เหลือ ${m}:${String(s).padStart(2, '0')})`, { duration: 4000 })
                return
            }

            updateCart([...cart, {
                courtId: court.courtId, courtName: court.courtName,
                date: selectedDate, startTime: slot.startTime, endTime: slot.endTime, price: slot.price,
            }])
            toast.success(`เพิ่ม ${slot.startTime} ลงตะกร้าแล้ว — Lock 20 นาที`)
        }
    }

    // Build calendar data for viewMonth/viewYear
    const getDaysInMonth = () => {
        const firstDay = new Date(viewYear, viewMonth, 1)
        const lastDay = new Date(viewYear, viewMonth + 1, 0)
        const startDow = firstDay.getDay() // 0=Sun
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

    // ── STEP 1: เลือกสถานที่เรียน ──────────────────────────────────────────────
    if (step === 1) {
        return (
            <div style={{ maxWidth: '700px', margin: '0 auto', padding: '32px 24px' }}>
                <StepWizard step={1} />
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, textAlign: 'center', marginBottom: '8px' }}>เลือกสถานที่เรียน</h2>
                    <p style={{ textAlign: 'center', color: 'var(--c-text-muted)', marginBottom: '40px', fontSize: '14px' }}>เลือกสถานที่ที่ต้องการจอง</p>

                    {loadingVenues ? (
                        <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" /></div>
                    ) : venues.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--c-text-muted)' }}>
                            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--c-text-secondary)', marginBottom: '8px' }}>ยังไม่มีสถานที่เรียน</p>
                            <p style={{ fontSize: '13px' }}>กรุณาเพิ่มสถานที่ผ่าน Admin Panel ก่อน</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                            {venues.map(venue => (
                                <motion.button key={venue.id} whileHover={{ scale: 1.04, y: -3 }} whileTap={{ scale: 0.97 }}
                                    onClick={() => { setSelectedVenue({ id: venue.id, name: venue.name, image: venue.image }); setStep(2) }}
                                    style={{
                                        padding: '0', borderRadius: '20px', cursor: 'pointer', overflow: 'hidden',
                                        border: '2px solid rgba(245,166,35,0.2)',
                                        background: 'rgba(255,255,255,0.03)',
                                        color: 'var(--c-text)', fontFamily: 'inherit',
                                        textAlign: 'center', display: 'flex', flexDirection: 'column',
                                    }}>
                                    <div style={{
                                        height: '140px', width: '100%',
                                        background: venue.image ? `url(${venue.image}) center/cover` : 'linear-gradient(135deg, #f5a623 0%, #e8912d 100%)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {!venue.image && <MapPin size={36} style={{ color: 'rgba(255,255,255,0.5)' }} />}
                                    </div>
                                    <div style={{ padding: '16px' }}>
                                        <span style={{ fontSize: '18px', fontWeight: 800 }}>{venue.name}</span>
                                        {venue.description && <p style={{ fontSize: '12px', color: 'var(--c-text-muted)', marginTop: '4px', margin: '4px 0 0' }}>{venue.description}</p>}
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>
        )
    }

    // ── STEP 2: เลือกวันที่ (calendar with month navigation) ─────────────────
    if (step === 2) {
        const calDays = getDaysInMonth()
        return (
            <div style={{ maxWidth: '700px', margin: '0 auto', padding: '32px 24px' }}>
                <StepWizard step={2} />
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                    {selectedVenue && <VenueBadge name={selectedVenue.name} image={selectedVenue.image} onClick={() => setStep(1)} />}
                </div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    {/* Month navigation */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', color: 'var(--c-text)', display: 'flex', alignItems: 'center' }}>
                            <ChevronLeft size={20} />
                        </button>
                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <div style={{ fontSize: '20px', fontWeight: 800 }}>
                                {MONTH_TH[viewMonth]}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--c-text-muted)' }}>{viewYear + 543}</div>
                            {(viewMonth !== new Date().getMonth() || viewYear !== new Date().getFullYear()) && (
                                <button
                                    onClick={() => { setViewMonth(new Date().getMonth()); setViewYear(new Date().getFullYear()) }}
                                    style={{
                                        marginTop: '4px', padding: '4px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                                        background: 'var(--c-primary)', color: 'white', border: 'none', cursor: 'pointer',
                                    }}
                                >
                                    วันนี้
                                </button>
                            )}
                        </div>
                        <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', color: 'var(--c-text)', display: 'flex', alignItems: 'center' }}>
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Day header */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px' }}>
                        {DAY_TH.map(d => (
                            <div key={d} style={{ textAlign: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--c-text-muted)', padding: '6px 0' }}>{d}</div>
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

                            // Status colors & labels
                            const statusConfig = dayStatus === 'full'
                                ? { bg: 'rgba(225,112,85,0.15)', border: 'rgba(225,112,85,0.4)', text: 'เต็มแล้ว', color: '#e17055' }
                                : dayStatus === 'almost_full'
                                    ? { bg: 'rgba(245,166,35,0.15)', border: 'rgba(245,166,35,0.4)', text: `เหลือ ${freeSlots} ชม.`, color: '#f5a623' }
                                    : { bg: 'rgba(0,184,148,0.1)', border: 'rgba(0,184,148,0.3)', text: 'ว่าง', color: '#00b894' }

                            return (
                                <motion.button
                                    key={dateStr}
                                    whileHover={!isPast && !isClosed ? { scale: 1.08 } : undefined}
                                    whileTap={!isPast && !isClosed ? { scale: 0.95 } : undefined}
                                    onClick={() => !isPast && !isClosed && handleSelectDate(dateStr)}
                                    disabled={isPast || isClosed}
                                    style={{
                                        borderRadius: '12px', cursor: isPast || isClosed ? 'not-allowed' : 'pointer',
                                        border: isSelected ? '2px solid var(--c-primary)' : isToday ? '2px solid rgba(245,166,35,0.5)' : `1px solid ${!isPast && !isClosed && dayInfo ? statusConfig.border : '#e9ecef'}`,
                                        background: isSelected ? 'rgba(245,166,35,0.25)'
                                            : isPast ? '#f1f2f6'
                                                : isClosed ? 'rgba(225,112,85,0.06)'
                                                    : dayInfo ? statusConfig.bg
                                                        : isToday ? 'rgba(245,166,35,0.08)' : '#fff',
                                        color: isPast ? '#b2bec3' : isClosed ? '#b2bec3' : isSelected ? 'var(--c-text)' : isSun ? '#e17055' : isSat ? '#6c5ce7' : 'var(--c-text)',
                                        fontWeight: isSelected || isToday ? 800 : 600,
                                        fontSize: '15px', fontFamily: "'Inter', sans-serif",
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                                        opacity: isPast ? 0.6 : isClosed ? 0.4 : 1,
                                        position: 'relative', minHeight: '58px', padding: '6px 2px',
                                        textDecoration: isPast ? 'line-through' : 'none',
                                    }}>
                                    {date.getDate()}
                                    {!isPast && !isClosed && dayInfo && (
                                        <span style={{
                                            fontSize: '9px', fontWeight: 700, color: statusConfig.color,
                                            lineHeight: 1, whiteSpace: 'nowrap',
                                        }}>
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
                            { color: '#00b894', label: 'ว่าง' },
                            { color: '#f5a623', label: 'ใกล้เต็ม' },
                            { color: '#e17055', label: 'เต็ม' },
                            { color: '#b2bec3', label: 'ผ่านแล้ว' },
                        ].map(s => (
                            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--c-text-secondary)' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color, display: 'block' }} />
                                {s.label}
                            </div>
                        ))}
                    </div>

                    <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--c-text-muted)', marginTop: '12px' }}>
                        <Calendar size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
                        เลือกวันที่ต้องการจอง (สามารถจองล่วงหน้าได้)
                    </p>
                </motion.div>
            </div>
        )
    }

    // ── STEP 3: เลือกเวลา ─────────────────────────────────────────────────────
    const formatDateTH = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00')
        return `${d.getDate()} ${MONTH_TH[d.getMonth()]} ${d.getFullYear() + 543}`
    }

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px 140px' }}>
            <StepWizard step={3} />

            {/* Breadcrumb badges */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '28px', flexWrap: 'wrap' }}>
                {selectedVenue && <VenueBadge name={selectedVenue.name} image={selectedVenue.image} onClick={() => setStep(1)} />}
                {selectedDate && (
                    <div onClick={() => setStep(2)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '8px 18px', borderRadius: '999px', cursor: 'pointer',
                        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                    }}>
                        <Calendar size={14} style={{ color: '#10b981' }} />
                        <span style={{ fontWeight: 700, color: '#10b981', fontSize: '14px' }}>{formatDateTH(selectedDate)}</span>
                        <ArrowLeft size={13} style={{ color: 'var(--c-text-muted)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>เปลี่ยน</span>
                    </div>
                )}
            </div>

            {/* Court tabs */}
            {availability.length > 1 && (
                <div style={{ marginBottom: '28px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--c-text-secondary)' }}>
                        <MapPin size={16} style={{ color: 'var(--c-primary)' }} /> เลือกสนาม
                    </h3>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {availability.map(court => {
                            const active = selectedCourt === court.courtId
                            return (
                                <button key={court.courtId} onClick={() => setSelectedCourt(court.courtId)} style={{
                                    padding: '11px 26px', borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
                                    border: active ? '2px solid var(--c-primary)' : '2px solid rgba(255,255,255,0.08)',
                                    background: active ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.03)',
                                    color: active ? 'var(--c-primary-light)' : 'var(--c-text-secondary)',
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
                    <Clock size={18} style={{ color: 'var(--c-primary)' }} /> เลือกช่วงเวลา
                    {currentCourt && availability.length === 1 && (
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--c-text-muted)' }}>— {currentCourt.courtName}</span>
                    )}
                </h3>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" /></div>
                ) : !currentCourt || currentCourt.closed || currentCourt.slots.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--c-text-muted)' }}>
                        <Clock size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--c-text-secondary)' }}>ไม่มีเวลาว่างในวันนี้</p>
                        <button onClick={() => setStep(2)} style={{ marginTop: '16px', background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: '10px', padding: '10px 24px', cursor: 'pointer', color: 'var(--c-primary-light)', fontFamily: 'inherit', fontWeight: 600 }}>
                            เลือกวันอื่น
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '10px' }}>
                        {currentCourt.slots.map(slot => {
                            const inCart = selectedDate ? isInCart(currentCourt.courtId, selectedDate, slot.startTime) : false
                            const isPast = selectedDate ? isSlotPast(selectedDate, slot.startTime) : false
                            const isLockedByOther = slot.lockedByOther && !inCart
                            const isBooked = !slot.available && !inCart && !isLockedByOther
                            const isDisabled = isBooked || isLockedByOther || isPast

                            // Countdown for locked-by-other slots
                            const lockMins = isLockedByOther ? Math.floor(slot.secondsLeft / 60) : 0
                            const lockSecs = isLockedByOther ? slot.secondsLeft % 60 : 0

                            return (
                                <motion.button key={slot.startTime}
                                    whileHover={!isDisabled ? { scale: 1.04 } : undefined}
                                    whileTap={!isDisabled ? { scale: 0.96 } : undefined}
                                    onClick={() => !isDisabled && toggleSlot(currentCourt, slot)}
                                    disabled={isDisabled}
                                    style={{
                                        padding: '14px 8px', borderRadius: '12px',
                                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                                        border: inCart
                                            ? '2px solid var(--c-primary)'
                                            : isPast
                                                ? '2px solid rgba(225,112,85,0.2)'
                                                : isLockedByOther
                                                    ? '2px solid rgba(245,158,11,0.4)'
                                                    : isBooked
                                                        ? '2px solid rgba(0,0,0,0.03)'
                                                        : '2px solid rgba(0,0,0,0.06)',
                                        background: inCart
                                            ? 'rgba(245,166,35,0.2)'
                                            : isPast
                                                ? 'rgba(225,112,85,0.06)'
                                                : isLockedByOther
                                                    ? 'rgba(245,158,11,0.08)'
                                                    : isBooked
                                                        ? 'rgba(0,0,0,0.02)'
                                                        : 'rgba(255,255,255,0.6)',
                                        color: isPast
                                            ? '#b2bec3'
                                            : isBooked
                                                ? 'var(--c-text-muted)'
                                                : inCart
                                                    ? 'var(--c-primary)'
                                                    : isLockedByOther
                                                        ? '#f59e0b'
                                                        : 'var(--c-text)',
                                        fontFamily: "'Inter', sans-serif", textAlign: 'center',
                                        opacity: isBooked ? 0.35 : isPast ? 0.5 : 1, transition: 'all 0.15s',
                                        textDecoration: isPast ? 'line-through' : 'none',
                                    }}>
                                    <div style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.3px' }}>
                                        {slot.startTime}–{slot.endTime}
                                    </div>
                                    {isPast && <div style={{ fontSize: '10px', marginTop: '5px', color: '#e17055', fontWeight: 700 }}>⛔ เลยเวลา</div>}
                                    {isBooked && !isPast && <div style={{ fontSize: '10px', marginTop: '5px', color: 'var(--c-text-muted)' }}>จองแล้ว</div>}
                                    {inCart && !isPast && <div style={{ fontSize: '10px', marginTop: '5px', color: 'var(--c-primary-light)', fontWeight: 700 }}>✓ เลือกแล้ว</div>}
                                    {isLockedByOther && (
                                        <div style={{ fontSize: '10px', marginTop: '5px', color: '#f59e0b', fontWeight: 700 }}>
                                            <Lock size={9} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '2px' }} />
                                            {lockMins}:{String(lockSecs).padStart(2, '0')}
                                        </div>
                                    )}
                                    {!isBooked && !inCart && !isLockedByOther && (
                                        <div style={{ fontSize: '11px', marginTop: '5px', color: 'var(--c-text-muted)' }}>
                                            ฿{slot.price.toLocaleString()}
                                        </div>
                                    )}
                                </motion.button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Floating cart FAB */}
            {cart.length > 0 && (
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={{
                        position: 'fixed', bottom: '24px', right: '24px', zIndex: 50,
                    }}
                >
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => router.push('/cart')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '14px 24px', borderRadius: '999px',
                            background: 'linear-gradient(135deg, #f5a623 0%, #e6951a 100%)',
                            color: 'white', border: 'none', cursor: 'pointer',
                            boxShadow: '0 8px 30px rgba(245,166,35,0.4)',
                            fontFamily: 'inherit', fontWeight: 700, fontSize: '15px',
                        }}
                    >
                        <ShoppingCart size={20} />
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
