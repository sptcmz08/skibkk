'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Clock, MapPin, ShoppingCart, ArrowRight, ArrowLeft, Check, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface Slot {
    startTime: string
    endTime: string
    available: boolean
    price: number
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
        { num: 1, label: 'เลือกประเภทกีฬา' },
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
                            background: done ? 'rgba(16,185,129,0.08)' : active ? 'rgba(102,126,234,0.12)' : 'transparent',
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

// Sport type badge clickable
function SportBadge({ sport, onClick }: { sport: string; onClick: () => void }) {
    return (
        <div onClick={onClick} style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 18px', borderRadius: '999px', cursor: 'pointer',
            background: 'rgba(102,126,234,0.12)', border: '1px solid rgba(102,126,234,0.25)',
        }}>
            <span>{SPORT_ICONS[sport] || '🏟️'}</span>
            <span style={{ fontWeight: 700, color: 'var(--c-primary-light)', fontSize: '14px' }}>{sport}</span>
            <ArrowLeft size={13} style={{ color: 'var(--c-text-muted)' }} />
            <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>เปลี่ยน</span>
        </div>
    )
}

export default function CourtsPage() {
    const router = useRouter()
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [sportTypes, setSportTypes] = useState<string[]>([])
    const [allCourts, setAllCourts] = useState<CourtData[]>([])
    const [selectedSport, setSelectedSport] = useState<string | null>(null)
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
    const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
    const [availability, setAvailability] = useState<CourtData[]>([])
    const [selectedCourt, setSelectedCourt] = useState<string | null>(null)
    const [cart, setCart] = useState<CartItem[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingCourts, setLoadingCourts] = useState(true)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Load cart
    useEffect(() => {
        const saved = localStorage.getItem('skibkk-cart')
        if (saved) { try { setCart(JSON.parse(saved)) } catch { /* ignore */ } }
    }, [])

    // Load courts for sport types
    useEffect(() => {
        const fetchCourts = async () => {
            setLoadingCourts(true)
            try {
                const res = await fetch('/api/courts')
                const data = await res.json()
                if (data.courts) {
                    const types = [...new Set<string>(
                        data.courts.map((c: { sportType?: string }) => c.sportType).filter(Boolean)
                    )]
                    setSportTypes(types)
                    if (types.length === 0) setStep(2)
                }
            } catch { /* ignore */ } finally { setLoadingCourts(false) }
        }
        fetchCourts()
    }, [])

    const updateCart = (newCart: CartItem[]) => {
        setCart(newCart)
        localStorage.setItem('skibkk-cart', JSON.stringify(newCart))
        window.dispatchEvent(new Event('cart-updated'))
    }

    // Fetch availability when date selected
    const fetchAvailability = useCallback(async (dateStr: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/availability?date=${dateStr}`)
            const data = await res.json()
            if (data.availability) {
                const filtered = selectedSport
                    ? data.availability.filter((c: CourtData) => c.sportType === selectedSport)
                    : data.availability
                setAllCourts(data.availability)
                setAvailability(filtered)
                if (filtered.length > 0) {
                    setSelectedCourt(c => {
                        const exists = filtered.find((f: CourtData) => f.courtId === c)
                        return exists ? c : filtered[0].courtId
                    })
                }
            }
        } catch { toast.error('ไม่สามารถโหลดข้อมูลได้') }
        finally { setLoading(false) }
    }, [selectedSport])

    const handleSelectDate = (dateStr: string) => {
        setSelectedDate(dateStr)
        fetchAvailability(dateStr)
        setStep(3)
    }

    const isInCart = (courtId: string, date: string, startTime: string) =>
        cart.some(i => i.courtId === courtId && i.date === date && i.startTime === startTime)

    const toggleSlot = (court: CourtData, slot: Slot) => {
        if (!selectedDate) return
        if (isInCart(court.courtId, selectedDate, slot.startTime)) {
            updateCart(cart.filter(i => !(i.courtId === court.courtId && i.date === selectedDate && i.startTime === slot.startTime)))
            toast.success('ลบออกจากตะกร้าแล้ว')
        } else {
            updateCart([...cart, {
                courtId: court.courtId, courtName: court.courtName,
                date: selectedDate, startTime: slot.startTime, endTime: slot.endTime, price: slot.price,
            }])
            toast.success(`เพิ่ม ${slot.startTime} ลงตะกร้าแล้ว`)
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

    // ── STEP 1: เลือกประเภทกีฬา ──────────────────────────────────────────────
    if (step === 1) {
        return (
            <div style={{ maxWidth: '700px', margin: '0 auto', padding: '32px 24px' }}>
                <StepWizard step={1} />
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, textAlign: 'center', marginBottom: '8px' }}>เลือกประเภทกีฬา</h2>
                    <p style={{ textAlign: 'center', color: 'var(--c-text-muted)', marginBottom: '40px', fontSize: '14px' }}>เลือกกิจกรรมที่ต้องการจองสนาม</p>

                    {loadingCourts ? (
                        <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" /></div>
                    ) : sportTypes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--c-text-muted)' }}>
                            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--c-text-secondary)', marginBottom: '8px' }}>ยังไม่มีสนามในระบบ</p>
                            <p style={{ fontSize: '13px' }}>กรุณาเพิ่มสนามผ่าน Admin Panel ก่อน</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                            {sportTypes.map(type => (
                                <motion.button key={type} whileHover={{ scale: 1.04, y: -3 }} whileTap={{ scale: 0.97 }}
                                    onClick={() => { setSelectedSport(type); setStep(2) }}
                                    style={{
                                        padding: '36px 20px', borderRadius: '20px', cursor: 'pointer',
                                        border: '2px solid rgba(255,255,255,0.08)',
                                        background: 'rgba(255,255,255,0.03)',
                                        color: 'var(--c-text)', fontFamily: 'inherit',
                                        textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                                    }}>
                                    <span style={{ fontSize: '52px', lineHeight: 1 }}>{SPORT_ICONS[type] || '🏟️'}</span>
                                    <span style={{ fontSize: '20px', fontWeight: 800 }}>{type}</span>
                                    <span style={{ fontSize: '13px', color: 'var(--c-text-muted)' }}>
                                        {allCourts.filter(c => c.sportType === type).length || '...'} สนาม
                                    </span>
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
                    {selectedSport && <SportBadge sport={selectedSport} onClick={() => setStep(1)} />}
                </div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    {/* Month navigation */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', color: 'var(--c-text)', display: 'flex', alignItems: 'center' }}>
                            <ChevronLeft size={20} />
                        </button>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '20px', fontWeight: 800 }}>
                                {MONTH_TH[viewMonth]}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--c-text-muted)' }}>{viewYear + 543}</div>
                        </div>
                        <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', color: 'var(--c-text)', display: 'flex', alignItems: 'center' }}>
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Day header */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
                        {DAY_TH.map(d => (
                            <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--c-text-muted)', padding: '4px 0' }}>{d}</div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                        {calDays.map((date, idx) => {
                            if (!date) return <div key={`empty-${idx}`} />
                            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                            const isPast = date < today
                            const isToday = date.getTime() === today.getTime()
                            const isSelected = dateStr === selectedDate
                            const isSun = date.getDay() === 0
                            const isSat = date.getDay() === 6

                            return (
                                <motion.button
                                    key={dateStr}
                                    whileHover={!isPast ? { scale: 1.08 } : undefined}
                                    whileTap={!isPast ? { scale: 0.95 } : undefined}
                                    onClick={() => !isPast && handleSelectDate(dateStr)}
                                    disabled={isPast}
                                    style={{
                                        aspectRatio: '1', borderRadius: '10px', cursor: isPast ? 'not-allowed' : 'pointer',
                                        border: isSelected ? '2px solid var(--c-primary)' : isToday ? '2px solid rgba(102,126,234,0.4)' : '2px solid transparent',
                                        background: isSelected ? 'rgba(102,126,234,0.2)' : isToday ? 'rgba(102,126,234,0.08)' : 'rgba(255,255,255,0.02)',
                                        color: isPast ? 'rgba(255,255,255,0.15)' : isSelected ? 'white' : isSun ? '#f87171' : isSat ? '#818cf8' : 'var(--c-text)',
                                        fontWeight: isSelected || isToday ? 800 : 500,
                                        fontSize: '14px', fontFamily: "'Inter', sans-serif",
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: isPast ? 0.4 : 1,
                                    }}>
                                    {date.getDate()}
                                </motion.button>
                            )
                        })}
                    </div>

                    <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--c-text-muted)', marginTop: '20px' }}>
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
                {selectedSport && <SportBadge sport={selectedSport} onClick={() => setStep(1)} />}
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
                                    background: active ? 'rgba(102,126,234,0.15)' : 'rgba(255,255,255,0.03)',
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
                        <button onClick={() => setStep(2)} style={{ marginTop: '16px', background: 'rgba(102,126,234,0.15)', border: '1px solid rgba(102,126,234,0.3)', borderRadius: '10px', padding: '10px 24px', cursor: 'pointer', color: 'var(--c-primary-light)', fontFamily: 'inherit', fontWeight: 600 }}>
                            เลือกวันอื่น
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                        {currentCourt.slots.map(slot => {
                            const inCart = selectedDate ? isInCart(currentCourt.courtId, selectedDate, slot.startTime) : false
                            const booked = !slot.available && !inCart
                            return (
                                <motion.button key={slot.startTime}
                                    whileHover={!booked ? { scale: 1.04 } : undefined}
                                    whileTap={!booked ? { scale: 0.96 } : undefined}
                                    onClick={() => !booked && toggleSlot(currentCourt, slot)}
                                    disabled={booked}
                                    style={{
                                        padding: '16px 8px', borderRadius: '12px',
                                        cursor: booked ? 'not-allowed' : 'pointer',
                                        border: inCart ? '2px solid var(--c-primary)' : booked ? '2px solid rgba(255,255,255,0.03)' : '2px solid rgba(255,255,255,0.08)',
                                        background: inCart ? 'rgba(102,126,234,0.2)' : booked ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.04)',
                                        color: booked ? 'var(--c-text-muted)' : inCart ? 'var(--c-primary-light)' : 'var(--c-text)',
                                        fontFamily: "'Inter', sans-serif", textAlign: 'center',
                                        opacity: booked ? 0.35 : 1, transition: 'all 0.15s',
                                    }}>
                                    <div style={{ fontSize: '17px', fontWeight: 700, lineHeight: 1 }}>{slot.startTime}</div>
                                    {booked && <div style={{ fontSize: '10px', marginTop: '5px', color: 'var(--c-text-muted)' }}>จองแล้ว</div>}
                                    {inCart && <div style={{ fontSize: '10px', marginTop: '5px', color: 'var(--c-primary-light)', fontWeight: 700 }}>✓ เลือกแล้ว</div>}
                                    {!booked && !inCart && <div style={{ fontSize: '11px', marginTop: '5px', color: 'var(--c-text-muted)' }}>฿{slot.price.toLocaleString()}</div>}
                                </motion.button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Bottom cart bar */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
                padding: '14px 24px',
                background: 'rgba(13,13,35,0.96)', backdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    {cart.length > 0 ? (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px', maxHeight: '90px', overflowY: 'auto' }}>
                                {cart.map((item, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{item.courtName}</span>
                                        <span style={{ color: 'var(--c-text-muted)' }}>•</span>
                                        <span style={{ color: 'var(--c-text-secondary)' }}>
                                            {new Date(item.date + 'T00:00:00').getDate()} {MONTH_TH[new Date(item.date + 'T00:00:00').getMonth()]}
                                        </span>
                                        <span style={{ color: 'var(--c-text-secondary)' }}>{item.startTime}–{item.endTime}</span>
                                        <span style={{ marginLeft: 'auto', fontWeight: 700, fontFamily: "'Inter'" }}>฿{item.price.toLocaleString()}</span>
                                        <button onClick={() => updateCart(cart.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px' }}>
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button onClick={() => setStep(2)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', flexShrink: 0 }}>
                                    <ArrowLeft size={15} /> วันอื่น
                                </button>
                                <div style={{ flex: 1, textAlign: 'center' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--c-text-muted)' }}>{cart.length} รายการ</span>
                                    <span style={{ fontSize: '20px', fontWeight: 800, fontFamily: "'Inter'", marginLeft: '12px' }}>
                                        ฿{cart.reduce((s, i) => s + i.price, 0).toLocaleString()}
                                    </span>
                                </div>
                                <button onClick={() => router.push('/cart')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 22px', flexShrink: 0 }}>
                                    ถัดไป <ArrowRight size={15} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button onClick={() => setStep(2)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px' }}>
                                <ArrowLeft size={15} /> กลับ
                            </button>
                            <div style={{ flex: 1, textAlign: 'center', fontSize: '14px', color: 'var(--c-text-muted)' }}>
                                <ShoppingCart size={15} style={{ display: 'inline', verticalAlign: '-3px', marginRight: '6px' }} />
                                กดเลือกช่วงเวลาที่ต้องการ
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
