'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Trash2, Calendar, Clock, MapPin, ArrowRight, AlertCircle, ArrowLeft, Timer, UserPlus, LogIn, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { getSessionId } from '@/lib/session'
import { clearStoredCart, readStoredCart, syncCartWithServerLocks } from '@/lib/cart'
import type { CartItem } from '@/lib/cart'

export default function CartPage() {
    const router = useRouter()
    const [cart, setCart] = useState<CartItem[]>([])
    const [mounted, setMounted] = useState(false)
    const [user, setUser] = useState<{ name: string; email: string; phone: string } | null>(null)
    const [showAuthModal, setShowAuthModal] = useState(false)
    const syncToastShownRef = useRef(false)

    useEffect(() => {
        setMounted(true)
        let cancelled = false

        const syncCart = async () => {
            const result = await syncCartWithServerLocks(getSessionId())
            if (!cancelled) setCart(result.cart)
            if (!cancelled && result.changed && result.removedCount > 0 && !syncToastShownRef.current) {
                syncToastShownRef.current = true
                toast('รายการในตะกร้าหมดเวลา 20 นาทีแล้ว ระบบลบออกให้อัตโนมัติ', {
                    duration: 4500,
                    icon: '⏰',
                })
            }
        }

        syncCart().catch(() => {
            if (!cancelled) setCart(readStoredCart())
        })

        const handleCartUpdate = () => {
            if (!cancelled) setCart(readStoredCart())
        }
        window.addEventListener('cart-updated', handleCartUpdate)

        // Check auth status
        fetch('/api/auth/me', { cache: 'no-store' })
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.user) setUser(data.user) })
            .catch(() => { })

        return () => {
            cancelled = true
            window.removeEventListener('cart-updated', handleCartUpdate)
        }
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
        clearStoredCart({ clearDraft: true })
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
        const expiredRef = useRef(false)
        useEffect(() => {
            expiredRef.current = false
            const check = async () => {
                try {
                    const result = await syncCartWithServerLocks(getSessionId())
                    setCart(result.cart)
                    if (result.active && result.expiresAt) setExpiresAt(result.expiresAt)
                    else {
                        setExpiresAt(null)
                        if (result.changed && result.removedCount > 0 && !syncToastShownRef.current) {
                            syncToastShownRef.current = true
                            toast('รายการในตะกร้าหมดเวลา 20 นาทีแล้ว ระบบลบออกให้อัตโนมัติ', {
                                duration: 4500,
                                icon: '⏰',
                            })
                        }
                    }
                } catch { }
            }
            check()
            const poll = setInterval(check, 5000)
            return () => clearInterval(poll)
        }, [])
        useEffect(() => {
            if (!expiresAt) { setSecs(null); return }
            const tick = () => {
                const s = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))
                setSecs(s)
                // Auto-clear cart when lock expires
                if (s <= 0 && !expiredRef.current) {
                    expiredRef.current = true
                    clearStoredCart({ clearDraft: true })
                    setCart([])
                    fetch('/api/locks', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: getSessionId() }),
                    }).catch(() => { })
                    toast.error('หมดเวลาแล้ว ระบบล้างตะกร้าอัตโนมัติ กรุณาเลือกใหม่', { duration: 5000 })
                    setTimeout(() => router.push('/courts'), 2000)
                }
            }
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
                background: urgent ? 'rgba(239,68,68,0.1)' : 'rgba(250,204,21,0.12)',
                border: `1px solid ${urgent ? 'rgba(239,68,68,0.25)' : 'rgba(250,204,21,0.35)'}`,
                borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: urgent ? '#fca5a5' : '#B38600', fontWeight: 600, fontSize: '14px' }}>
                    <Timer size={16} />
                    <span>เวลา Lock หมดใน</span>
                </div>
                <span style={{ fontFamily: "'Inter', monospace", fontSize: '20px', fontWeight: 800, letterSpacing: '2px', color: urgent ? '#ef4444' : '#EAB308' }}>
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
                            <span style={{
                                fontSize: '14px',
                                color: '#2d2a00',
                                fontWeight: 800,
                                background: 'rgba(250,204,21,0.24)',
                                border: '1px solid rgba(250,204,21,0.55)',
                                borderRadius: '999px',
                                padding: '4px 10px',
                            }}>({cart.length} รายการ)</span>
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
                            {Object.entries(groupedByDate)
                                .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                                .map(([date, items]) => (
                                <motion.div
                                    key={date}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    style={{ marginBottom: '24px' }}
                                >
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px',
                                        padding: '12px 16px', borderRadius: '12px',
                                        background: 'linear-gradient(135deg, rgba(250,204,21,0.24), rgba(255,255,255,0.92))',
                                        border: '2px solid rgba(250,204,21,0.45)',
                                        boxShadow: '0 8px 24px rgba(250,204,21,0.12)',
                                    }}>
                                        <Calendar size={20} style={{ color: '#B38600' }} />
                                        <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--c-text)' }}>
                                            {new Date(date).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                        </span>
                                        <span style={{
                                            fontSize: '13px',
                                            color: '#2d2a00',
                                            marginLeft: 'auto',
                                            fontWeight: 800,
                                            background: '#fff',
                                            border: '1px solid rgba(250,204,21,0.45)',
                                            borderRadius: '999px',
                                            padding: '4px 10px',
                                        }}>
                                            {items.length} รายการ
                                        </span>
                                    </div>

                                    {[...items]
                                        .sort((itemA, itemB) => itemA.startTime.localeCompare(itemB.startTime) || itemA.endTime.localeCompare(itemB.endTime) || itemA.courtName.localeCompare(itemB.courtName))
                                        .map((item, idx) => {
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
                        <div className="glass-card" style={{
                            cursor: 'default',
                            marginTop: '24px',
                            background: '#fff',
                            border: '2px solid rgba(250,204,21,0.45)',
                            boxShadow: '0 12px 32px rgba(250,204,21,0.14)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ color: 'var(--c-text-secondary)', fontWeight: 700 }}>จำนวนรายการ</span>
                                <span style={{ fontWeight: 900, color: 'var(--c-text)' }}>{cart.length} ชั่วโมง</span>
                            </div>
                            <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontSize: '18px', fontWeight: 700 }}>ยอดรวม</span>
                                    <p style={{ fontSize: '12px', color: 'var(--c-text-muted)', margin: '2px 0 0' }}>* ราคานี้รวม VAT 7% แล้ว</p>
                                </div>
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
                            onClick={() => {
                                if (user) {
                                    router.push('/booking')
                                } else {
                                    setShowAuthModal(true)
                                }
                            }}
                        >
                            ดำเนินการจอง
                            <ArrowRight size={20} />
                        </motion.button>
                    </>
                )}
            </motion.div>

            {/* Auth required modal */}
            <AnimatePresence>
                {showAuthModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowAuthModal(false)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 100,
                            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '24px',
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                width: '100%', maxWidth: '440px',
                                background: 'var(--c-bg-secondary, #1a1a2e)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '20px', padding: '36px',
                                textAlign: 'center', position: 'relative',
                            }}
                        >
                            <button
                                onClick={() => setShowAuthModal(false)}
                                style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--c-text-muted)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>

                            <div style={{
                                width: '72px', height: '72px', borderRadius: '50%',
                                background: 'rgba(250,204,21,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 20px',
                            }}>
                                <AlertCircle size={36} style={{ color: 'var(--c-primary)' }} />
                            </div>

                            <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>
                                กรุณาเข้าสู่ระบบ
                            </h3>
                            <p style={{ color: 'var(--c-text-secondary)', fontSize: '14px', marginBottom: '28px', lineHeight: 1.6 }}>
                                สมัครสมาชิกหรือเข้าสู่ระบบเพื่อดำเนินการจองต่อ<br />
                                ข้อมูลในตะกร้าของคุณจะยังคงอยู่
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <a
                                    href="/api/auth/line?returnUrl=/cart"
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                        padding: '14px', borderRadius: '12px', cursor: 'pointer',
                                        background: '#06C755', color: 'white', fontWeight: 700, fontSize: '15px',
                                        textDecoration: 'none', border: 'none', width: '100%',
                                    }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" /></svg>
                                    เข้าสู่ระบบด้วย LINE
                                </a>
                                <p style={{ fontSize: '12px', color: 'var(--c-text-muted)', marginTop: '8px', textAlign: 'center' }}>
                                    ข้อมูลในตะกร้าของคุณจะยังคงอยู่
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
