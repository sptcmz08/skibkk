'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Trash2, Calendar, Clock, MapPin, ArrowRight, AlertCircle, ArrowLeft, Timer } from 'lucide-react'
import toast from 'react-hot-toast'
import { getSessionId } from '@/lib/session'

interface CartItem {
    courtId: string
    courtName: string
    date: string
    startTime: string
    endTime: string
    price: number
}

export default function CartPage() {
    const router = useRouter()
    const [cart, setCart] = useState<CartItem[]>([])
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const stored: CartItem[] = JSON.parse(localStorage.getItem('skibkk-cart') || '[]')
        setCart(stored)
        // Note: locks are created on the courts page when adding to cart.
        // We do NOT re-lock here to avoid resetting the 20-min countdown timer.
    }, [])

    const removeItem = (index: number) => {
        const item = cart[index]
        const newCart = cart.filter((_, i) => i !== index)
        setCart(newCart)
        localStorage.setItem('skibkk-cart', JSON.stringify(newCart))
        window.dispatchEvent(new Event('cart-updated'))
        toast.success('ลบรายการแล้ว')
        // Release lock for this slot
        const sessionId = getSessionId()
        fetch('/api/locks', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                slots: [{ courtId: item.courtId, date: item.date, startTime: item.startTime }],
            }),
        }).catch(() => { })
    }

    const clearCart = () => {
        setCart([])
        localStorage.setItem('skibkk-cart', '[]')
        window.dispatchEvent(new Event('cart-updated'))
        toast.success('ล้างตะกร้าแล้ว')
        // Release all locks for this session
        const sessionId = getSessionId()
        fetch('/api/locks', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
        }).catch(() => { })
    }

    const total = cart.reduce((sum, item) => sum + item.price, 0)

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr)
        return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    }

    // Group by date
    const groupedByDate = cart.reduce((acc, item) => {
        if (!acc[item.date]) acc[item.date] = []
        acc[item.date].push(item)
        return acc
    }, {} as Record<string, CartItem[]>)

    if (!mounted) return null

    // Inline live countdown for the cart page body (header CartTimer is primary)
    const CartInlineTimer = () => {
        const [expiresAt, setExpiresAt] = useState<Date | null>(null)
        const [secs, setSecs] = useState<number | null>(null)
        useEffect(() => {
            const check = async () => {
                try {
                    const res = await fetch(`/api/locks/check?sessionId=${getSessionId()}`, { cache: 'no-store' })
                    const data = await res.json()
                    if (data.active && data.expiresAt) setExpiresAt(new Date(data.expiresAt))
                    else setExpiresAt(null)
                } catch { }
            }
            check()
            const poll = setInterval(check, 5000)
            return () => clearInterval(poll)
        }, [])
        useEffect(() => {
            if (!expiresAt) { setSecs(null); return }
            const tick = () => setSecs(Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000)))
            tick()
            const id = setInterval(tick, 1000)
            return () => clearInterval(id)
        }, [expiresAt])
        if (secs === null || secs <= 0) return null
        const m = Math.floor(secs / 60), s = secs % 60
        const urgent = secs < 120
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: urgent ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${urgent ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)'}`,
                borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: urgent ? '#fca5a5' : '#fcd34d', fontWeight: 600, fontSize: '14px' }}>
                    <Timer size={16} />
                    <span>เวลา Lock หมดใน</span>
                </div>
                <span style={{ fontFamily: "'Inter', monospace", fontSize: '20px', fontWeight: 800, letterSpacing: '2px', color: urgent ? '#ef4444' : '#f59e0b' }}>
                    {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
                </span>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
            {/* Back button */}
            <button onClick={() => router.back()} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: 'none', cursor: 'pointer', padding: '0',
                color: 'var(--c-text-secondary)', fontSize: '14px', fontWeight: 600, marginBottom: '20px',
            }}>
                <ArrowLeft size={16} /> ย้อนกลับ
            </button>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, fontFamily: "'Inter', sans-serif", letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ShoppingCart size={28} style={{ color: 'var(--c-primary)' }} />
                        ตะกร้าสินค้า
                        {cart.length > 0 && (
                            <span style={{ fontSize: '16px', color: 'var(--c-text-muted)', fontWeight: 500 }}>({cart.length} รายการ)</span>
                        )}
                    </h1>
                    {cart.length > 0 && (
                        <button onClick={clearCart} className="btn btn-sm" style={{ background: 'rgba(245,87,108,0.1)', color: 'var(--c-danger)', border: '1px solid rgba(245,87,108,0.2)' }}>
                            <Trash2 size={14} /> ล้างตะกร้า
                        </button>
                    )}
                </div>

                {cart.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--c-text-muted)' }}>
                        <ShoppingCart size={64} style={{ marginBottom: '20px', opacity: 0.3 }} />
                        <p style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--c-text-secondary)' }}>ตะกร้าว่างเปล่า</p>
                        <p style={{ marginBottom: '24px' }}>เลือกสนามและเวลาที่ต้องการจากหน้าจองสนาม</p>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ display: 'inline-block' }}>
                            <a href="/courts" className="btn btn-primary">
                                <Calendar size={18} /> ไปหน้าจองสนาม
                            </a>
                        </motion.div>
                    </div>
                ) : (
                    <>
                        {/* Inline live countdown */}
                        <CartInlineTimer />

                        {/* Cart items grouped by date */}
                        <AnimatePresence>
                            {Object.entries(groupedByDate).map(([date, items]) => (
                                <motion.div
                                    key={date}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    style={{ marginBottom: '24px' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--c-text-secondary)', fontSize: '14px', fontWeight: 600 }}>
                                        <Calendar size={16} />
                                        {formatDate(date)}
                                    </div>

                                    {items.map((item, idx) => {
                                        const originalIndex = cart.findIndex(
                                            (c) => c.courtId === item.courtId && c.date === item.date && c.startTime === item.startTime
                                        )
                                        return (
                                            <motion.div
                                                key={`${item.courtId}-${item.startTime}`}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10, height: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="glass-card"
                                                style={{
                                                    cursor: 'default',
                                                    marginBottom: '10px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '16px 20px',
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <div style={{
                                                        width: '44px',
                                                        height: '44px',
                                                        borderRadius: '12px',
                                                        background: 'var(--c-gradient)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '20px',
                                                        flexShrink: 0,
                                                    }}>
                                                        🏟️
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <MapPin size={14} style={{ color: 'var(--c-primary)' }} />
                                                            {item.courtName}
                                                        </div>
                                                        <div style={{ fontSize: '14px', color: 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                            <Clock size={14} />
                                                            {item.startTime} - {item.endTime}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 800, fontSize: '18px', fontFamily: "'Inter', sans-serif", color: 'var(--c-primary-light)' }}>
                                                            ฿{item.price.toLocaleString()}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => removeItem(originalIndex)}
                                                        style={{
                                                            background: 'rgba(245,87,108,0.1)',
                                                            border: '1px solid rgba(245,87,108,0.2)',
                                                            borderRadius: '8px',
                                                            color: 'var(--c-danger)',
                                                            cursor: 'pointer',
                                                            padding: '8px',
                                                            transition: 'all 0.2s',
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Summary */}
                        <div className="glass-card" style={{ cursor: 'default', marginTop: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ color: 'var(--c-text-secondary)' }}>จำนวนรายการ</span>
                                <span style={{ fontWeight: 600 }}>{cart.length} ชั่วโมง</span>
                            </div>
                            <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '18px', fontWeight: 700 }}>ยอดรวม</span>
                                <span style={{ fontSize: '28px', fontWeight: 900, fontFamily: "'Inter', sans-serif", background: 'var(--c-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                    ฿{total.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="btn btn-success btn-block btn-lg"
                            style={{ marginTop: '20px' }}
                            onClick={() => router.push('/booking')}
                        >
                            ดำเนินการจอง
                            <ArrowRight size={20} />
                        </motion.button>
                    </>
                )}
            </motion.div>
        </div>
    )
}
