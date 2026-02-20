'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Calendar, Clock, MapPin, Package, Settings, LogOut, History } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface UserData {
    id: string; name: string; email: string; phone: string; role: string
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
            fetch('/api/auth/me').then(r => r.json()),
            fetch('/api/bookings').then(r => r.json()),
        ]).then(([userData, bookingData]) => {
            if (userData.user) setUser(userData.user)
            else { router.push('/login'); return }
            if (bookingData.bookings) setBookings(bookingData.bookings)
        }).catch(() => toast.error('ไม่สามารถโหลดข้อมูลได้')).finally(() => setLoading(false))
    }, [router])

    const statusBadge = (status: string) => {
        const map: Record<string, { class: string; label: string }> = {
            PENDING: { class: 'badge-pending', label: 'รอชำระเงิน' },
            CONFIRMED: { class: 'badge-success', label: 'ยืนยันแล้ว' },
            CANCELLED: { class: 'badge-danger', label: 'ยกเลิก' },
        }
        const s = map[status] || { class: 'badge-info', label: status }
        return <span className={`badge ${s.class}`}>{s.label}</span>
    }

    if (loading) return <div className="loading-page"><div className="spinner" /></div>
    if (!user) return null

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
            {/* Profile header */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ cursor: 'default', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--c-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 800, color: 'white', fontFamily: "'Inter'" }}>
                    {user.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>{user.name}</h1>
                    <p style={{ color: 'var(--c-text-secondary)', fontSize: '14px' }}>{user.email}</p>
                    {user.phone && <p style={{ color: 'var(--c-text-muted)', fontSize: '13px' }}>{user.phone}</p>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <span className="badge badge-info">{user.role === 'CUSTOMER' ? 'สมาชิก' : user.role}</span>
                </div>
            </motion.div>

            {/* Stats */}
            <div className="grid-3" style={{ marginBottom: '32px' }}>
                {[
                    { icon: <Calendar size={24} />, value: bookings.length, label: 'การจองทั้งหมด', gradient: 'var(--c-gradient)' },
                    { icon: <Clock size={24} />, value: bookings.filter(b => b.status === 'CONFIRMED').length, label: 'จองสำเร็จ', gradient: 'var(--c-gradient-success)' },
                    { icon: <Package size={24} />, value: `฿${bookings.filter(b => b.status === 'CONFIRMED').reduce((s, b) => s + b.totalAmount, 0).toLocaleString()}`, label: 'ยอดใช้จ่ายรวม', gradient: 'var(--c-gradient-accent)' },
                ].map((stat, i) => (
                    <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        className="glass-card" style={{ cursor: 'default', textAlign: 'center', padding: '20px' }}
                    >
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: stat.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: '0 auto 12px' }}>
                            {stat.icon}
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 900, fontFamily: "'Inter'", marginBottom: '4px' }}>{stat.value}</div>
                        <div style={{ fontSize: '13px', color: 'var(--c-text-muted)' }}>{stat.label}</div>
                    </motion.div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                {[
                    { key: 'bookings' as const, icon: <History size={16} />, label: 'ประวัติการจอง' },
                    { key: 'settings' as const, icon: <Settings size={16} />, label: 'ตั้งค่า' },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`btn ${tab === t.key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Booking History */}
            {tab === 'bookings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {bookings.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--c-text-muted)' }}>
                            <Calendar size={48} style={{ marginBottom: '16px', opacity: 0.4 }} />
                            <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--c-text-secondary)' }}>ยังไม่มีประวัติการจอง</p>
                            <a href="/courts" className="btn btn-primary btn-sm" style={{ display: 'inline-flex' }}>
                                จองสนามเลย
                            </a>
                        </div>
                    ) : bookings.map((booking, i) => (
                        <motion.div key={booking.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                            className="glass-card" style={{ cursor: 'default' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                                <div>
                                    <span style={{ fontWeight: 700, fontSize: '15px', fontFamily: "'Inter'" }}>{booking.bookingNumber}</span>
                                    <span style={{ color: 'var(--c-text-muted)', fontSize: '13px', marginLeft: '12px' }}>
                                        {new Date(booking.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                {statusBadge(booking.status)}
                            </div>
                            {booking.bookingItems.map((item, j) => (
                                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '14px', color: 'var(--c-text-secondary)' }}>
                                    <MapPin size={14} style={{ color: 'var(--c-primary)' }} />
                                    <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{item.court.name}</span>
                                    <span>•</span>
                                    <span>{new Date(item.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                                    <span>{item.startTime}-{item.endTime}</span>
                                    <span style={{ marginLeft: 'auto', fontWeight: 600 }}>฿{item.price.toLocaleString()}</span>
                                </div>
                            ))}
                            <div style={{ borderTop: '1px solid var(--c-border)', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: 'var(--c-text-muted)' }}>
                                    ผู้เรียน: {booking.participants.map(p => p.name).join(', ') || '-'}
                                </div>
                                <div style={{ fontWeight: 800, fontFamily: "'Inter'", fontSize: '17px' }}>
                                    ฿{booking.totalAmount.toLocaleString()}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Settings */}
            {tab === 'settings' && (
                <div className="glass-card" style={{ cursor: 'default' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={20} /> ข้อมูลส่วนตัว
                    </h3>
                    <div style={{ display: 'grid', gap: '16px' }}>
                        <div className="input-group">
                            <label>ชื่อ</label>
                            <input className="input-field" value={user.name} readOnly />
                        </div>
                        <div className="input-group">
                            <label>อีเมล</label>
                            <input className="input-field" value={user.email} readOnly />
                        </div>
                        <div className="input-group">
                            <label>เบอร์โทรศัพท์</label>
                            <input className="input-field" value={user.phone || '-'} readOnly />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
