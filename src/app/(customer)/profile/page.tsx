'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Calendar, Clock, MapPin, Package, Settings, History, Mail, Phone, Shield, ChevronRight, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface UserData {
    id: string; name: string; email: string; phone: string; role: string
    lineDisplayName?: string; lineAvatar?: string
}
interface Booking {
    id: string; bookingNumber: string; status: string; totalAmount: number; createdAt: string
    bookingItems: Array<{ court: { name: string }; date: string; startTime: string; endTime: string; price: number }>
    participants: Array<{ name: string; sportType: string }>
    payments: Array<{ method: string; status: string; amount: number }>
}

export default function ProfilePage() {
    const router = useRouter()
    const [user, setUser] = useState<UserData | null>(null)
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'bookings' | 'settings'>('bookings')

    useEffect(() => {
        Promise.all([
            fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json()),
            fetch('/api/bookings', { cache: 'no-store' }).then(r => r.json()),
        ]).then(([authData, bookingsData]) => {
            if (authData.user) setUser(authData.user)
            else { router.push('/login'); return }
            if (bookingsData.bookings) setBookings(bookingsData.bookings)
        }).catch(() => toast.error('ไม่สามารถโหลดข้อมูลได้')).finally(() => setLoading(false))
    }, [router])

    const confirmedBookings = bookings.filter(b => b.status === 'CONFIRMED')
    const totalSpent = confirmedBookings.reduce((s, b) => s + b.totalAmount, 0)
    const totalHours = confirmedBookings.reduce((s, b) => s + b.bookingItems.length, 0)

    const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
        PENDING: { bg: 'rgba(255,193,7,0.12)', color: '#ffc107', label: 'รอชำระเงิน' },
        CONFIRMED: { bg: 'rgba(56,239,125,0.12)', color: '#00b894', label: 'ยืนยันแล้ว' },
        CANCELLED: { bg: 'rgba(245,87,108,0.12)', color: '#e17055', label: 'ยกเลิก' },
    }

    if (loading) return <div className="loading-page"><div className="spinner" /></div>
    if (!user) return null

    return (
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 24px 60px' }}>

            {/* ── Hero Profile Banner ── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    position: 'relative', overflow: 'hidden',
                    borderRadius: '24px', marginBottom: '28px',
                    background: 'linear-gradient(135deg, rgba(245,166,35,0.15) 0%, rgba(230,149,26,0.15) 50%, rgba(253,203,110,0.1) 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                }}
            >
                {/* Background decoration */}
                <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,166,35,0.2), transparent)', filter: 'blur(60px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-30%', left: '10%', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(253,203,110,0.15), transparent)', filter: 'blur(40px)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', padding: '36px 32px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                    {/* Avatar */}
                    {user.lineAvatar ? (
                        <img
                            src={user.lineAvatar}
                            alt={user.name}
                            style={{ width: '88px', height: '88px', borderRadius: '24px', border: '3px solid rgba(255,255,255,0.15)', objectFit: 'cover' }}
                        />
                    ) : (
                        <div style={{
                            width: '88px', height: '88px', borderRadius: '24px',
                            background: 'var(--c-gradient)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '36px', fontWeight: 900, color: 'white',
                            fontFamily: "'Inter'", border: '3px solid rgba(255,255,255,0.15)',
                            boxShadow: '0 8px 32px rgba(245,166,35,0.3)',
                        }}>
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                    )}

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px' }}>{user.name}</h1>
                            <span style={{
                                padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                                background: 'rgba(245,166,35,0.2)', color: 'var(--c-primary-light)',
                                display: 'flex', alignItems: 'center', gap: '4px',
                            }}>
                                <Shield size={12} /> {user.role === 'CUSTOMER' ? 'สมาชิก' : user.role}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '14px', color: 'var(--c-text-secondary)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Mail size={14} style={{ color: 'var(--c-primary)' }} /> {user.email}
                            </span>
                            {user.phone && !user.phone.startsWith('LINE-') && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Phone size={14} style={{ color: 'var(--c-primary)' }} /> {user.phone}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ── Stats Row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
                {[
                    { icon: <Calendar size={22} />, value: bookings.length, label: 'การจองทั้งหมด', gradient: 'var(--c-gradient)', shadow: 'rgba(245,166,35,0.25)' },
                    { icon: <Clock size={22} />, value: `${totalHours} ชม.`, label: 'เวลาเล่นรวม', gradient: 'var(--c-gradient-success)', shadow: 'rgba(56,239,125,0.25)' },
                    { icon: <Package size={22} />, value: `฿${totalSpent.toLocaleString()}`, label: 'ยอดใช้จ่าย', gradient: 'var(--c-gradient-accent)', shadow: 'rgba(253,203,110,0.25)' },
                ].map((stat, i) => (
                    <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
                        style={{
                            background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)',
                            borderRadius: '18px', padding: '22px 18px', textAlign: 'center',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                    >
                        <div style={{
                            width: '46px', height: '46px', borderRadius: '14px',
                            background: stat.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', margin: '0 auto 14px',
                            boxShadow: `0 6px 20px ${stat.shadow}`,
                        }}>
                            {stat.icon}
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: 900, fontFamily: "'Inter'", marginBottom: '2px' }}>{stat.value}</div>
                        <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', fontWeight: 500 }}>{stat.label}</div>
                    </motion.div>
                ))}
            </div>

            {/* ── Tab Navigation ── */}
            <div style={{
                display: 'inline-flex', gap: '4px', marginBottom: '24px',
                background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)',
                borderRadius: '14px', padding: '4px',
            }}>
                {[
                    { key: 'bookings' as const, icon: <History size={15} />, label: 'ประวัติการจอง' },
                    { key: 'settings' as const, icon: <Settings size={15} />, label: 'ข้อมูลส่วนตัว' },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '7px',
                            padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
                            transition: 'all 0.2s',
                            background: tab === t.key ? 'var(--c-gradient)' : 'transparent',
                            color: tab === t.key ? 'white' : 'var(--c-text-muted)',
                            boxShadow: tab === t.key ? '0 4px 15px rgba(245,166,35,0.3)' : 'none',
                        }}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ── Booking History ── */}
            <AnimatePresence mode="wait">
                {tab === 'bookings' && (
                    <motion.div key="bookings" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
                    >
                        {bookings.length === 0 ? (
                            <div style={{
                                textAlign: 'center', padding: '60px 20px',
                                background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)',
                                borderRadius: '20px',
                            }}>
                                <div style={{
                                    width: '64px', height: '64px', borderRadius: '20px',
                                    background: 'rgba(245,166,35,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 16px',
                                }}>
                                    <Sparkles size={28} style={{ color: 'var(--c-primary)' }} />
                                </div>
                                <p style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: 'var(--c-text-secondary)' }}>ยังไม่มีประวัติการจอง</p>
                                <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '20px' }}>มาสนุกกับกิจกรรมกีฬากัน!</p>
                                <a href="/courts" className="btn btn-primary btn-sm">จองสนามเลย <ChevronRight size={16} /></a>
                            </div>
                        ) : bookings.map((booking, i) => {
                            const sc = statusConfig[booking.status] || { bg: 'rgba(245,166,35,0.1)', color: '#f5a623', label: booking.status }
                            return (
                                <motion.div key={booking.id}
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                    onClick={() => router.push(`/booking/${booking.id}`)}
                                    style={{
                                        background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)',
                                        borderRadius: '18px', padding: '22px 24px',
                                        transition: 'border-color 0.2s, transform 0.15s',
                                        cursor: 'pointer',
                                    }}
                                    whileHover={{ scale: 1.01, borderColor: 'rgba(245,166,35,0.3)' }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {/* Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{
                                                fontWeight: 800, fontSize: '15px', fontFamily: "'Inter'",
                                                background: 'var(--c-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                            }}>
                                                #{booking.bookingNumber}
                                            </span>
                                            <span style={{ color: 'var(--c-text-muted)', fontSize: '12px' }}>
                                                {new Date(booking.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                                padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                                                background: sc.bg, color: sc.color,
                                            }}>
                                                {sc.label}
                                            </span>
                                            <ChevronRight size={16} style={{ color: 'var(--c-text-muted)' }} />
                                        </div>
                                    </div>

                                    {/* Items */}
                                    {booking.bookingItems.map((item, j) => (
                                        <div key={j} style={{
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            padding: '10px 14px', marginBottom: '6px',
                                            background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                                            fontSize: '14px', color: 'var(--c-text-secondary)',
                                        }}>
                                            <MapPin size={14} style={{ color: 'var(--c-primary)', flexShrink: 0 }} />
                                            <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{item.court.name}</span>
                                            <span style={{ opacity: 0.4 }}>•</span>
                                            <span>{new Date(item.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                                            <span>{item.startTime}-{item.endTime}</span>
                                            <span style={{ marginLeft: 'auto', fontWeight: 700, fontFamily: "'Inter'", color: 'var(--c-text)' }}>฿{item.price.toLocaleString()}</span>
                                        </div>
                                    ))}

                                    {/* Footer */}
                                    <div style={{
                                        borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '12px', paddingTop: '14px',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}>
                                        <div style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>
                                            👤 {booking.participants.map(p => p.name).join(', ') || '-'}
                                        </div>
                                        <div style={{
                                            fontWeight: 900, fontFamily: "'Inter'", fontSize: '18px',
                                            background: 'var(--c-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                        }}>
                                            ฿{booking.totalAmount.toLocaleString()}
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </motion.div>
                )}

                {/* ── Settings ── */}
                {tab === 'settings' && (
                    <motion.div key="settings" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        style={{
                            background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)',
                            borderRadius: '20px', padding: '32px',
                        }}
                    >
                        <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <User size={20} style={{ color: 'var(--c-primary)' }} /> ข้อมูลส่วนตัว
                        </h3>
                        <div style={{ display: 'grid', gap: '18px' }}>
                            {[
                                { label: 'ชื่อ-สกุล', value: user.name, icon: <User size={16} /> },
                                { label: 'อีเมล', value: user.email, icon: <Mail size={16} /> },
                                { label: 'เบอร์โทรศัพท์', value: user.phone?.startsWith('LINE-') ? 'ยังไม่ได้ระบุ' : (user.phone || '-'), icon: <Phone size={16} /> },
                            ].map(field => (
                                <div key={field.label}>
                                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--c-text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {field.icon} {field.label}
                                    </label>
                                    <div style={{
                                        padding: '14px 18px', borderRadius: '12px',
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                                        fontSize: '15px', fontWeight: 500, color: 'var(--c-text)',
                                    }}>
                                        {field.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
