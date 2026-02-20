'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Trash2, Calendar, Clock, MapPin, ArrowRight, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

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
        const stored = JSON.parse(localStorage.getItem('skibkk-cart') || '[]')
        setCart(stored)
    }, [])

    const removeItem = (index: number) => {
        const newCart = cart.filter((_, i) => i !== index)
        setCart(newCart)
        localStorage.setItem('skibkk-cart', JSON.stringify(newCart))
        window.dispatchEvent(new Event('cart-updated'))
        toast.success('ลบรายการแล้ว')
    }

    const clearCart = () => {
        setCart([])
        localStorage.setItem('skibkk-cart', '[]')
        window.dispatchEvent(new Event('cart-updated'))
        toast.success('ล้างตะกร้าแล้ว')
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

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
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
                        {/* Countdown warning */}
                        <div className="countdown-bar">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={18} />
                                <span className="countdown-text">เวลา Lock หมดใน</span>
                            </div>
                            <span className="countdown-timer">20:00</span>
                        </div>

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
