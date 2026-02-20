'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, MapPin, ShoppingCart, ArrowRight, ArrowLeft, Check, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface Slot {
    startTime: string
    endTime: string
    available: boolean
    price: number
    lockedBy?: string | null
}

interface CourtAvailability {
    courtId: string
    courtName: string
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

export default function CourtsPage() {
    const router = useRouter()
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() + 1) // default to tomorrow
        return d.toISOString().split('T')[0]
    })
    const [availability, setAvailability] = useState<CourtAvailability[]>([])
    const [selectedCourt, setSelectedCourt] = useState<string | null>(null)
    const [cart, setCart] = useState<CartItem[]>([])
    const [loading, setLoading] = useState(true)

    // Generate 14 dates starting from today
    const dates = Array.from({ length: 14 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() + i)
        return d
    })

    const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
    const todayStr = new Date().toISOString().split('T')[0]

    // Load cart from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('skibkk-cart')
        if (saved) {
            try { setCart(JSON.parse(saved)) } catch { /* ignore */ }
        }
    }, [])

    const updateCart = (newCart: CartItem[]) => {
        setCart(newCart)
        localStorage.setItem('skibkk-cart', JSON.stringify(newCart))
        window.dispatchEvent(new Event('cart-updated'))
    }

    // Fetch availability
    const fetchAvailability = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/availability?date=${selectedDate}`)
            const data = await res.json()
            if (data.availability) {
                setAvailability(data.availability)
                if (data.availability.length > 0) {
                    setSelectedCourt(prev => {
                        const exists = data.availability.find((c: CourtAvailability) => c.courtId === prev)
                        return exists ? prev : data.availability[0].courtId
                    })
                }
            }
        } catch {
            toast.error('ไม่สามารถโหลดข้อมูลได้')
        } finally {
            setLoading(false)
        }
    }, [selectedDate])

    useEffect(() => { fetchAvailability() }, [fetchAvailability])

    const isInCart = (courtId: string, date: string, startTime: string) =>
        cart.some(item => item.courtId === courtId && item.date === date && item.startTime === startTime)

    const toggleSlot = (court: CourtAvailability, slot: Slot) => {
        if (isInCart(court.courtId, selectedDate, slot.startTime)) {
            const newCart = cart.filter(item =>
                !(item.courtId === court.courtId && item.date === selectedDate && item.startTime === slot.startTime)
            )
            updateCart(newCart)
            toast.success('ลบออกจากตะกร้าแล้ว')
        } else {
            updateCart([...cart, {
                courtId: court.courtId,
                courtName: court.courtName,
                date: selectedDate,
                startTime: slot.startTime,
                endTime: slot.endTime,
                price: slot.price,
            }])
            toast.success(`เพิ่ม ${slot.startTime} ลงตะกร้าแล้ว`)
        }
    }

    const removeFromCart = (index: number) => {
        updateCart(cart.filter((_, i) => i !== index))
    }

    const currentCourt = availability.find(c => c.courtId === selectedCourt)

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px 120px' }}>
            {/* ═══════════ Step Wizard ═══════════ */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0', marginBottom: '44px', flexWrap: 'wrap',
            }}>
                {[
                    { num: 1, label: 'เลือกบริการ', done: true },
                    { num: 2, label: 'เลือกวัน/เวลา', active: true },
                    { num: 3, label: 'กรอกข้อมูล' },
                    { num: 4, label: 'ชำระเงิน' },
                ].map((s, i) => (
                    <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '6px 14px', borderRadius: '8px',
                            background: s.done ? 'rgba(16,185,129,0.08)' : s.active ? 'rgba(102,126,234,0.1)' : 'transparent',
                        }}>
                            <div style={{
                                width: '26px', height: '26px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '12px', fontWeight: 700,
                                background: s.done ? '#10b981' : s.active ? 'var(--c-primary)' : 'rgba(255,255,255,0.08)',
                                color: (s.done || s.active) ? 'white' : 'var(--c-text-muted)',
                            }}>
                                {s.done ? <Check size={13} /> : s.num}
                            </div>
                            <span style={{
                                fontSize: '13px', fontWeight: s.active ? 700 : 500,
                                color: s.done ? '#10b981' : s.active ? 'var(--c-text)' : 'var(--c-text-muted)',
                            }}>{s.label}</span>
                        </div>
                        {i < 3 && <div style={{ width: '20px', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />}
                    </div>
                ))}
            </div>

            {/* ═══════════ Court Selection ═══════════ */}
            {availability.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={18} style={{ color: 'var(--c-primary)' }} /> เลือกสนาม
                    </h3>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {availability.map(court => {
                            const active = selectedCourt === court.courtId
                            return (
                                <button key={court.courtId} onClick={() => setSelectedCourt(court.courtId)}
                                    style={{
                                        padding: '12px 28px', borderRadius: '12px', cursor: 'pointer',
                                        border: active ? '2px solid var(--c-primary)' : '2px solid rgba(255,255,255,0.08)',
                                        background: active ? 'rgba(102,126,234,0.15)' : 'rgba(255,255,255,0.03)',
                                        color: active ? 'var(--c-primary-light)' : 'var(--c-text-secondary)',
                                        fontWeight: 700, fontSize: '14px', fontFamily: 'inherit',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {court.courtName}
                                </button>
                            )
                        })}
                    </div>
                </motion.div>
            )}

            {/* ═══════════ Date Grid (2 rows × 7 cols) ═══════════ */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={{ marginBottom: '36px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={18} style={{ color: 'var(--c-primary)' }} /> เลือกวันที่
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                    {dates.map(date => {
                        const dateStr = date.toISOString().split('T')[0]
                        const isSelected = dateStr === selectedDate
                        const isToday = dateStr === todayStr
                        return (
                            <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
                                style={{
                                    position: 'relative', padding: '12px 4px', borderRadius: '12px',
                                    cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
                                    border: isSelected
                                        ? '2px solid var(--c-primary)'
                                        : '2px solid rgba(255,255,255,0.06)',
                                    background: isSelected
                                        ? 'rgba(102,126,234,0.15)'
                                        : 'rgba(255,255,255,0.02)',
                                    color: isSelected ? 'white' : 'var(--c-text-secondary)',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {isToday && (
                                    <div style={{
                                        position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)',
                                        background: 'var(--c-primary)', color: 'white', fontSize: '9px', fontWeight: 700,
                                        padding: '1px 8px', borderRadius: '4px', whiteSpace: 'nowrap',
                                    }}>วันนี้</div>
                                )}
                                <div style={{ fontSize: '11px', color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--c-text-muted)', marginBottom: '2px' }}>
                                    {dayNames[date.getDay()]}
                                </div>
                                <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: "'Inter', sans-serif", lineHeight: 1.2 }}>
                                    {date.getDate()}
                                </div>
                                <div style={{ fontSize: '11px', color: isSelected ? 'rgba(255,255,255,0.5)' : 'var(--c-text-muted)' }}>
                                    {date.getMonth() + 1}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </motion.div>

            {/* ═══════════ Time Slots Grid ═══════════ */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={18} style={{ color: 'var(--c-primary)' }} /> เลือกเวลา
                    {currentCourt && (
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--c-text-muted)', marginLeft: '4px' }}>
                            — {currentCourt.courtName}
                        </span>
                    )}
                </h3>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div className="spinner" />
                    </div>
                ) : availability.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--c-text-muted)' }}>
                        <Calendar size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                        <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--c-text-secondary)', marginBottom: '8px' }}>
                            ไม่มีข้อมูลสนาม
                        </p>
                        <p style={{ fontSize: '13px' }}>กรุณาเพิ่มสนามผ่าน Admin Panel ก่อน</p>
                    </div>
                ) : !currentCourt || currentCourt.slots.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--c-text-muted)' }}>
                        <Clock size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--c-text-secondary)' }}>
                            ไม่มีเวลาว่างในวันนี้
                        </p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                        gap: '10px',
                    }}>
                        {currentCourt.slots.map(slot => {
                            const inCart = isInCart(currentCourt.courtId, selectedDate, slot.startTime)
                            const booked = !slot.available && !inCart

                            return (
                                <motion.button
                                    key={slot.startTime}
                                    whileHover={!booked ? { scale: 1.03 } : undefined}
                                    whileTap={!booked ? { scale: 0.97 } : undefined}
                                    onClick={() => !booked && toggleSlot(currentCourt, slot)}
                                    disabled={booked}
                                    style={{
                                        padding: '16px 8px', borderRadius: '12px',
                                        cursor: booked ? 'not-allowed' : 'pointer',
                                        border: inCart
                                            ? '2px solid var(--c-primary)'
                                            : booked
                                                ? '2px solid rgba(255,255,255,0.03)'
                                                : '2px solid rgba(255,255,255,0.08)',
                                        background: inCart
                                            ? 'rgba(102,126,234,0.2)'
                                            : booked
                                                ? 'rgba(255,255,255,0.01)'
                                                : 'rgba(255,255,255,0.04)',
                                        color: booked ? 'var(--c-text-muted)' : inCart ? 'var(--c-primary-light)' : 'var(--c-text)',
                                        fontFamily: "'Inter', sans-serif",
                                        textAlign: 'center',
                                        opacity: booked ? 0.4 : 1,
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <div style={{
                                        fontSize: '16px', fontWeight: 700, lineHeight: 1,
                                        textDecoration: booked ? 'line-through' : 'none',
                                    }}>
                                        {slot.startTime}
                                    </div>
                                    {booked && (
                                        <div style={{ fontSize: '10px', marginTop: '4px', textDecoration: 'none', color: 'var(--c-text-muted)' }}>
                                            จองแล้ว
                                        </div>
                                    )}
                                    {inCart && (
                                        <div style={{ fontSize: '10px', marginTop: '4px', color: 'var(--c-primary-light)', fontWeight: 600 }}>
                                            ✓ เลือกแล้ว
                                        </div>
                                    )}
                                    {!booked && !inCart && (
                                        <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--c-text-muted)', fontFamily: "'Inter'" }}>
                                            ฿{slot.price.toLocaleString()}
                                        </div>
                                    )}
                                </motion.button>
                            )
                        })}
                    </div>
                )}
            </motion.div>

            {/* ═══════════ Bottom Navigation / Cart Summary ═══════════ */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                padding: '16px 24px', zIndex: 50,
                background: 'rgba(13, 13, 35, 0.95)',
                backdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    {cart.length > 0 ? (
                        <>
                            {/* Cart items (collapsible) */}
                            <div style={{
                                display: 'flex', flexDirection: 'column', gap: '4px',
                                marginBottom: '12px', maxHeight: '100px', overflowY: 'auto',
                            }}>
                                {cart.map((item, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        fontSize: '13px', color: 'var(--c-text-secondary)',
                                    }}>
                                        <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{item.courtName}</span>
                                        <span style={{ opacity: 0.4 }}>•</span>
                                        <span>{new Date(item.date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                                        <span>{item.startTime}–{item.endTime}</span>
                                        <span style={{ marginLeft: 'auto', fontWeight: 600, fontFamily: "'Inter'" }}>
                                            ฿{item.price.toLocaleString()}
                                        </span>
                                        <button onClick={() => removeFromCart(i)} style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#ef4444', padding: '2px', display: 'flex',
                                        }}>
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Bottom buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button onClick={() => router.push('/')}
                                    className="btn btn-secondary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px' }}
                                >
                                    <ArrowLeft size={16} /> กลับ
                                </button>
                                <div style={{ flex: 1, textAlign: 'center' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--c-text-muted)' }}>
                                        {cart.length} รายการ
                                    </span>
                                    <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: "'Inter'", marginLeft: '12px' }}>
                                        ฿{cart.reduce((s, item) => s + item.price, 0).toLocaleString()}
                                    </span>
                                </div>
                                <button onClick={() => router.push('/cart')}
                                    className="btn btn-primary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px' }}
                                >
                                    ถัดไป <ArrowRight size={16} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button onClick={() => router.push('/')}
                                className="btn btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px' }}
                            >
                                <ArrowLeft size={16} /> กลับ
                            </button>
                            <div style={{ flex: 1, textAlign: 'center', fontSize: '14px', color: 'var(--c-text-muted)' }}>
                                <ShoppingCart size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: '6px' }} />
                                เลือกเวลาที่ต้องการจอง
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
