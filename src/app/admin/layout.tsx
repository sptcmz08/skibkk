'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
    LayoutDashboard, MapPin, DollarSign, Package, Calendar, ClipboardList,
    Users, GraduationCap, FileText, BarChart3, Clock, Shield,
    LogOut, Menu, X, ChevronDown, Settings, Star, BookOpen, Dumbbell, UserPlus, Home
} from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [user, setUser] = useState<{ name: string; role: string } | null>(null)

    // Open sidebar by default on desktop
    useEffect(() => {
        if (window.innerWidth > 1024) setSidebarOpen(true)
    }, [])

    useEffect(() => {
        fetch('/api/auth/me', { cache: 'no-store' })
            .then(r => {
                if (!r.ok) throw new Error('Not authenticated')
                return r.json()
            })
            .then(d => {
                if (d.user && ['ADMIN', 'SUPERUSER', 'STAFF'].includes(d.user.role)) {
                    setUser(d.user)
                } else {
                    router.push('/admin/login')
                }
            })
            .catch(() => router.push('/admin/login'))
    }, [router])

    const navItems = [
        { href: '/admin', icon: LayoutDashboard, label: 'แดชบอร์ด', section: '' },
        { href: '/admin/courts', icon: MapPin, label: 'จัดการสนาม', section: 'จัดการ' },
        { href: '/admin/sport-types', icon: Dumbbell, label: 'ประเภทกีฬา', section: '' },
        { href: '/admin/venues', icon: MapPin, label: 'สถานที่เรียน', section: '' },
        { href: '/admin/pricing', icon: DollarSign, label: 'กำหนดราคา', section: '' },
        { href: '/admin/packages', icon: Package, label: 'แพ็คเกจ', section: '' },
        { href: '/admin/calendar', icon: Calendar, label: 'ปฏิทินการจอง', section: 'การจอง' },
        { href: '/admin/book', icon: UserPlus, label: 'จองให้ลูกค้า', section: '' },
        { href: '/admin/bookings', icon: ClipboardList, label: 'รายการจองทั้งหมด', section: '' },
        { href: '/admin/participants', icon: Users, label: 'ผู้เรียน & ครูสอน', section: '' },
        { href: '/admin/customers', icon: Users, label: 'ลูกค้า', section: '' },
        { href: '/admin/teachers', icon: GraduationCap, label: 'ครูผู้สอน', section: 'บุคลากร' },
        { href: '/admin/evaluations', icon: Star, label: 'แบบประเมิน', section: '' },
        { href: '/admin/invoices', icon: FileText, label: 'ใบกำกับภาษี', section: 'รายงาน' },
        { href: '/admin/invoice-report', icon: FileText, label: 'รวมใบกำกับภาษี', section: '' },
        { href: '/admin/reports', icon: BarChart3, label: 'สรุปการจอง', section: '' },
        { href: '/admin/teacher-report', icon: BookOpen, label: 'ชั่วโมงสอน', section: '' },
        { href: '/admin/availability', icon: Clock, label: 'ตรวจสอบเวลาว่าง', section: '' },
        { href: '/admin/users', icon: Shield, label: 'ผู้ใช้งาน', section: 'ระบบ' },
        { href: '/admin/logs', icon: FileText, label: 'บันทึกการใช้งาน', section: '' },
        { href: '/admin/settings', icon: Settings, label: 'ตั้งค่าเว็บไซต์', section: '' },
    ]

    const getPageTitle = () => {
        const item = navItems.find(n => n.href === pathname)
        return item?.label || 'แดชบอร์ด'
    }

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/courts'
    }

    // Group items by section
    let currentSection = ''

    // Skip layout for login page
    if (pathname === '/admin/login') {
        return <>{children}</>
    }

    if (!user) return <div className="loading-page" style={{ background: 'var(--a-bg)' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)' }} /></div>

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <aside className="admin-sidebar"
                style={{ transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.3s ease' }}
            >
                <div className="admin-sidebar-header">
                    <div className="admin-sidebar-logo">S</div>
                    <div>
                        <div className="admin-sidebar-title">SKIBKK</div>
                        <div className="admin-sidebar-subtitle">Admin Panel</div>
                    </div>
                </div>

                {/* Home Button */}
                <div style={{ padding: '0 12px 8px' }}>
                    <button
                        onClick={() => {
                            const today = new Date()
                            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                            router.push(`/admin/calendar?date=${dateStr}`)
                            if (window.innerWidth <= 1024) setSidebarOpen(false)
                        }}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'linear-gradient(135deg, var(--a-primary), #818cf8)',
                            color: '#fff', border: 'none', borderRadius: '10px',
                            padding: '10px 14px', cursor: 'pointer', fontSize: '14px',
                            fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s',
                            boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.5)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(99, 102, 241, 0.35)' }}
                    >
                        <Home size={18} />
                        หน้าหลัก
                    </button>
                </div>

                <nav className="admin-sidebar-nav">
                    {navItems.map((item) => {
                        const showSection = item.section && item.section !== currentSection
                        if (showSection) currentSection = item.section

                        return (
                            <div key={item.href}>
                                {showSection && (
                                    <div className="admin-nav-section">{item.section}</div>
                                )}
                                <Link
                                    href={item.href}
                                    className={`admin-nav-link ${pathname === item.href ? 'active' : ''}`}
                                    onClick={() => { if (window.innerWidth <= 1024) setSidebarOpen(false) }}
                                >
                                    <item.icon size={18} className="nav-icon" />
                                    {item.label}
                                </Link>
                            </div>
                        )
                    })}
                </nav>

                {/* User info at bottom */}
                <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'var(--a-primary)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontWeight: 700, fontSize: '14px',
                        }}>
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{user.role}</div>
                        </div>
                    </div>
                    <button onClick={handleLogout}
                        style={{
                            width: '100%', padding: '8px', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            fontFamily: 'inherit',
                        }}
                    >
                        <LogOut size={14} /> ออกจากระบบ
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="admin-content" style={{ marginLeft: sidebarOpen ? '260px' : '0', transition: 'margin-left 0.3s ease' }}>
                <header className="admin-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => setSidebarOpen(!sidebarOpen)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text)', padding: '8px', display: 'flex', alignItems: 'center' }}
                        >
                            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                        <h1 className="admin-topbar-title">{getPageTitle()}</h1>
                    </div>
                    <div className="admin-topbar-actions">
                        <Link href="/courts" style={{ fontSize: '13px', color: 'var(--a-text-secondary)', textDecoration: 'none' }}>
                            🌐 ดูหน้าเว็บไซต์
                        </Link>
                    </div>
                </header>

                <main className="admin-page">
                    {children}
                </main>
            </div>

            {/* Mobile overlay — hidden on desktop via CSS */}
            {sidebarOpen && (
                <div
                    className="admin-mobile-overlay"
                    onClick={() => setSidebarOpen(false)}
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.5)', zIndex: 49,
                        display: 'none',
                    }}
                />
            )}
        </div>
    )
}
