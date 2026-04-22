'use client'

import { formatPackageBookingWindow, formatPackageDate } from '@/lib/package-window'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Calendar, Clock, MapPin, Package, Settings, History, Mail, Phone, Shield, ChevronRight, Sparkles, Save, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface UserData {
    id: string
    name: string
    firstName?: string | null
    lastName?: string | null
    email: string
    phone: string
    role: string
    lineDisplayName?: string | null
    lineAvatar?: string | null
}
interface Booking {
    id: string; bookingNumber: string; status: string; totalAmount: number; createdAt: string
    bookingItems: Array<{ court: { name: string }; date: string; startTime: string; endTime: string; price: number }>
    participants: Array<{ name: string; sportType: string }>
    payments: Array<{ method: string; status: string; amount: number }>
}
interface UserPackage {
    id: string
    remainingHours: number
    purchasedAt: string
    expiresAt: string
    package: { id: string; name: string; totalHours: number; price: number; validFrom: string | null; validTo: string | null }
}
interface PackageUsage {
    id: string
    amount: number
    packageId: string | null
    userPackageId?: string | null
    createdAt: string
    booking: {
        bookingNumber: string
        bookingItems: Array<{ date: string; startTime: string; endTime: string; court: { name: string } }>
    }
}

export default function ProfilePage() {
    const router = useRouter()
    const [user, setUser] = useState<UserData | null>(null)
    const [bookings, setBookings] = useState<Booking[]>([])
    const [packages, setPackages] = useState<UserPackage[]>([])
    const [packageUsage, setPackageUsage] = useState<PackageUsage[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'bookings' | 'packages' | 'settings'>('bookings')
    const [editProfile, setEditProfile] = useState(false)
    const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
    const [savingProfile, setSavingProfile] = useState(false)

    useEffect(() => {
        Promise.all([
            fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json()),
            fetch('/api/bookings', { cache: 'no-store' }).then(r => r.json()),
            fetch('/api/user-packages?includeAll=1&withUsage=1', { cache: 'no-store' }).then(r => r.json()),
        ]).then(([authData, bookingsData, packageData]) => {
            if (authData.user) {
                setUser(authData.user)
                setProfileForm({
                    firstName: authData.user.firstName || '',
                    lastName: authData.user.lastName || '',
                    email: authData.user.email || '',
                    phone: authData.user.phone?.startsWith('LINE-') ? '' : (authData.user.phone || ''),
                })
                const shouldCompleteProfile = !authData.user.firstName || !authData.user.lastName || window.location.search.includes('complete=1')
                if (shouldCompleteProfile) {
                    setTab('settings')
                    setEditProfile(true)
                }
            }
            else { router.push('/login'); return }
            if (bookingsData.bookings) setBookings(bookingsData.bookings)
            if (packageData.packages) setPackages(packageData.packages)
            if (packageData.usage) setPackageUsage(packageData.usage)
        }).catch(() => toast.error('ไม่สามารถโหลดข้อมูลได้')).finally(() => setLoading(false))
    }, [router])

    const handleSaveProfile = async () => {
        if (!profileForm.firstName.trim() || !profileForm.lastName.trim() || !profileForm.email.trim() || !profileForm.phone.trim()) {
            toast.error('กรุณากรอกชื่อจริง นามสกุล อีเมล และเบอร์โทรให้ครบ')
            return
        }
        setSavingProfile(true)
        try {
            const res = await fetch('/api/auth/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileForm),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(data.error || 'บันทึกข้อมูลไม่สำเร็จ')
                return
            }
            setUser(data.user)
            setProfileForm({
                firstName: data.user.firstName || '',
                lastName: data.user.lastName || '',
                email: data.user.email || '',
                phone: data.user.phone?.startsWith('LINE-') ? '' : (data.user.phone || ''),
            })
            setEditProfile(false)
            toast.success('บันทึกข้อมูลส่วนตัวแล้ว')
        } catch {
            toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
        } finally {
            setSavingProfile(false)
        }
    }

    const confirmedBookings = bookings.filter(b => b.status === 'CONFIRMED')
    const totalSpent = confirmedBookings.reduce((s, b) => s + b.totalAmount, 0)
    const totalHours = confirmedBookings.reduce((s, b) => s + b.bookingItems.length, 0)
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.name || user?.lineDisplayName || 'ลูกค้า'
    const avatarLabel = (user?.lineDisplayName || fullName || 'ล').charAt(0).toUpperCase()

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
                    background: 'linear-gradient(135deg, rgba(250,204,21,0.15) 0%, rgba(217,169,0,0.15) 50%, rgba(254,240,138,0.1) 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                }}
            >
                {/* Background decoration */}
                <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(250,204,21,0.2), transparent)', filter: 'blur(60px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-30%', left: '10%', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(254,240,138,0.15), transparent)', filter: 'blur(40px)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', padding: '36px 32px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                    {/* Avatar */}
                    {user.lineAvatar ? (
                        <img
                            src={user.lineAvatar}
                            alt={fullName}
                            style={{ width: '88px', height: '88px', borderRadius: '24px', border: '3px solid rgba(255,255,255,0.15)', objectFit: 'cover' }}
                        />
                    ) : (
                        <div style={{
                            width: '88px', height: '88px', borderRadius: '24px',
                            background: 'var(--c-gradient)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '36px', fontWeight: 900, color: 'white',
                            fontFamily: "'Inter'", border: '3px solid rgba(255,255,255,0.15)',
                            boxShadow: '0 8px 32px rgba(250,204,21,0.3)',
                        }}>
                            {avatarLabel}
                        </div>
                    )}

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px' }}>{fullName}</h1>
                            <span style={{
                                padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                                background: 'rgba(250,204,21,0.2)', color: 'var(--c-primary-light)',
                                display: 'flex', alignItems: 'center', gap: '4px',
                            }}>
                                <Shield size={12} /> {user.role === 'CUSTOMER' ? 'สมาชิก' : user.role}
                            </span>
                        </div>
                        {user.lineDisplayName && (
                            <div style={{ marginBottom: '10px', fontSize: '13px', color: 'var(--c-text-muted)' }}>
                                LINE: <span style={{ fontWeight: 700, color: 'var(--c-text-secondary)' }}>{user.lineDisplayName}</span>
                            </div>
                        )}
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
                    { icon: <Calendar size={22} />, value: bookings.length, label: 'การจองทั้งหมด', gradient: 'var(--c-gradient)', shadow: 'rgba(250,204,21,0.25)' },
                    { icon: <Clock size={22} />, value: `${totalHours} ชม.`, label: 'เวลาเล่นรวม', gradient: 'var(--c-gradient-success)', shadow: 'rgba(56,239,125,0.25)' },
                    { icon: <Package size={22} />, value: `฿${totalSpent.toLocaleString()}`, label: 'ยอดใช้จ่าย', gradient: 'var(--c-gradient-accent)', shadow: 'rgba(254,240,138,0.25)' },
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
                    { key: 'packages' as const, icon: <Package size={15} />, label: 'แพ็คเกจของฉัน' },
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
                            boxShadow: tab === t.key ? '0 4px 15px rgba(250,204,21,0.3)' : 'none',
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
                                    background: 'rgba(250,204,21,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 16px',
                                }}>
                                    <Sparkles size={28} style={{ color: 'var(--c-primary)' }} />
                                </div>
                                <p style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: 'var(--c-text-secondary)' }}>ยังไม่มีประวัติการจอง</p>
                                <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '20px' }}>มาสนุกกับกิจกรรมกีฬากัน!</p>
                                <a href="/courts" className="btn btn-primary btn-sm">จองสนามเลย <ChevronRight size={16} /></a>
                            </div>
                        ) : bookings
                            .map(b => ({
                                ...b,
                                bookingItems: [...b.bookingItems].sort((a, c) => {
                                    const da = a.date.split('T')[0] + a.startTime
                                    const dc = c.date.split('T')[0] + c.startTime
                                    return da.localeCompare(dc)
                                }),
                            }))
                            .sort((a, b) => {
                                const ea = a.bookingItems[0]?.date.split('T')[0] || ''
                                const eb = b.bookingItems[0]?.date.split('T')[0] || ''
                                return ea.localeCompare(eb)
                            })
                            .map((booking, i) => {
                            const sc = statusConfig[booking.status] || { bg: 'rgba(250,204,21,0.1)', color: '#B38600', label: booking.status }
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
                                    whileHover={{ scale: 1.01, borderColor: 'rgba(250,204,21,0.3)' }}
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
                                                {new Date(booking.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
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
                                            <span>{new Date(item.date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <User size={20} style={{ color: 'var(--c-primary)' }} /> ข้อมูลส่วนตัว
                            </h3>
                            {!editProfile ? (
                                <button
                                    onClick={() => setEditProfile(true)}
                                    style={{ border: '1px solid rgba(250,204,21,0.35)', background: 'rgba(250,204,21,0.12)', color: '#2d2a00', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Pencil size={14} /> แก้ไข
                                </button>
                            ) : (
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={savingProfile}
                                    style={{ border: 'none', background: 'var(--c-gradient)', color: '#2d2a00', borderRadius: '10px', padding: '8px 14px', cursor: savingProfile ? 'not-allowed' : 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: savingProfile ? 0.7 : 1 }}
                                >
                                    <Save size={14} /> {savingProfile ? 'กำลังบันทึก...' : 'บันทึก'}
                                </button>
                            )}
                        </div>
                        {(!user.firstName || !user.lastName) && (
                            <div style={{
                                marginBottom: '20px',
                                padding: '14px 16px',
                                borderRadius: '14px',
                                background: 'rgba(250,204,21,0.1)',
                                border: '1px solid rgba(250,204,21,0.2)',
                                color: 'var(--c-text-secondary)',
                                fontSize: '14px',
                                fontWeight: 600,
                            }}>
                                กรุณากรอกชื่อจริงและนามสกุลของลูกค้าให้ครบ เพื่อใช้ในโปรไฟล์และเอกสารการจอง
                            </div>
                        )}
                        <div style={{ display: 'grid', gap: '18px' }}>
                            <div>
                                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--c-text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <User size={16} /> ชื่อ LINE
                                </label>
                                <div style={{
                                    padding: '14px 18px', borderRadius: '12px',
                                    background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.18)',
                                    fontSize: '15px', fontWeight: 700, color: 'var(--c-text)',
                                }}>
                                    {user.lineDisplayName || '-'}
                                </div>
                            </div>
                            {[
                                { label: 'ชื่อจริง', key: 'firstName' as const, value: profileForm.firstName, fallback: user.firstName || '-', icon: <User size={16} /> },
                                { label: 'นามสกุล', key: 'lastName' as const, value: profileForm.lastName, fallback: user.lastName || '-', icon: <User size={16} /> },
                                { label: 'อีเมล', key: 'email' as const, value: profileForm.email, fallback: user.email, icon: <Mail size={16} /> },
                                { label: 'เบอร์โทรศัพท์', key: 'phone' as const, value: profileForm.phone, fallback: user.phone?.startsWith('LINE-') ? 'ยังไม่ได้ระบุ' : (user.phone || '-'), icon: <Phone size={16} /> },
                            ].map(field => (
                                <div key={field.label}>
                                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--c-text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {field.icon} {field.label}
                                    </label>
                                    {editProfile ? (
                                        <input
                                            className="input-field"
                                            type={field.key === 'email' ? 'email' : 'text'}
                                            value={field.value}
                                            onChange={e => setProfileForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            placeholder={field.label}
                                        />
                                    ) : (
                                        <div style={{
                                            padding: '14px 18px', borderRadius: '12px',
                                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                                            fontSize: '15px', fontWeight: 500, color: 'var(--c-text)',
                                        }}>
                                            {field.fallback}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {tab === 'packages' && (
                    <motion.div key="packages" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        style={{ display: 'grid', gap: '14px' }}
                    >
                        {packages.length === 0 ? (
                            <div style={{ background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)', borderRadius: '20px', padding: '28px', color: 'var(--c-text-muted)' }}>
                                ยังไม่มีแพ็คเกจ
                            </div>
                        ) : packages.map(pkg => {
                            const packageUsages = packageUsage.filter(log => (log.userPackageId || null) === pkg.id)
                            const bookingWindow = formatPackageBookingWindow(pkg.package.validFrom, pkg.package.validTo)
                            return (
                                <div key={pkg.id} style={{ background: 'var(--c-glass)', border: '1px solid var(--c-glass-border)', borderRadius: '18px', padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: '17px' }}>{pkg.package.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                                {bookingWindow && <span>จองสนามได้วันที่ {bookingWindow}</span>}
                                                <span>ซื้อเมื่อ {formatPackageDate(pkg.purchasedAt)} • หมดอายุ {formatPackageDate(pkg.expiresAt)}</span>
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 900, fontFamily: "'Inter'", color: 'var(--c-primary-light)' }}>
                                            เหลือ {pkg.remainingHours} / {pkg.package.totalHours} ชม.
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '12px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>การใช้งานแพ็คเกจ</div>
                                        {packageUsages.length === 0 ? (
                                            <div style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>ยังไม่มีรายการใช้งาน</div>
                                        ) : (
                                            <div style={{ display: 'grid', gap: '6px' }}>
                                                {packageUsages.map(usage => (
                                                    <div key={usage.id} style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '12px' }}>
                                                        <div style={{ fontWeight: 700 }}>#{usage.booking.bookingNumber} • ใช้แพ็คเกจ ({usage.booking.bookingItems.length} ชม.)</div>
                                                        <div style={{ color: 'var(--c-text-muted)', marginTop: '2px' }}>
                                                            {usage.booking.bookingItems.map(item => `${new Date(item.date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${item.startTime}-${item.endTime} ${item.court.name}`).join(' | ')}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
