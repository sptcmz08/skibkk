'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
    LayoutDashboard, MapPin, DollarSign, Package, Calendar, ClipboardList,
    Users, GraduationCap, FileText, BarChart3, Clock, Shield,
    LogOut, Menu, X, ChevronDown, Settings, Star, BookOpen, Dumbbell, UserPlus, Home
} from 'lucide-react'

// Role hierarchy for client-side nav filtering
const ROLE_LEVEL: Record<string, number> = { CUSTOMER: 0, STAFF: 1, ADMIN: 2, SUPERUSER: 3 }
const hasMinRole = (userRole: string, minRole: string) => (ROLE_LEVEL[userRole] || 0) >= (ROLE_LEVEL[minRole] || 0)

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

    const allNavItems = [
        { href: '/admin', icon: LayoutDashboard, label: 'แดชบอร์ด', section: '', minRole: 'STAFF' },
        { href: '/admin/courts', icon: MapPin, label: 'จัดการสนาม', section: 'จัดการ', minRole: 'ADMIN' },
        { href: '/admin/sport-types', icon: Dumbbell, label: 'ประเภทกีฬา', section: '', minRole: 'ADMIN' },
        { href: '/admin/venues', icon: MapPin, label: 'สถานที่เรียน', section: '', minRole: 'ADMIN' },
        { href: '/admin/pricing', icon: DollarSign, label: 'กำหนดราคา', section: '', minRole: 'ADMIN' },
        { href: '/admin/packages', icon: Package, label: 'แพ็คเกจ', section: '', minRole: 'ADMIN' },
        { href: '/admin/calendar', icon: Calendar, label: 'ปฏิทินการจอง', section: 'การจอง', minRole: 'STAFF' },
        { href: '/admin/book', icon: UserPlus, label: 'จองให้ลูกค้า', section: '', minRole: 'STAFF' },
        { href: '/admin/bookings', icon: ClipboardList, label: 'รายการจองทั้งหมด', section: '', minRole: 'STAFF' },
        { href: '/admin/participants', icon: Users, label: 'ผู้เรียน & ครูสอน', section: '', minRole: 'STAFF' },
        { href: '/admin/customers', icon: Users, label: 'ลูกค้า', section: '', minRole: 'STAFF' },
        { href: '/admin/teachers', icon: GraduationCap, label: 'ครูผู้สอน', section: 'บุคลากร', minRole: 'ADMIN' },
        { href: '/admin/evaluations', icon: Star, label: 'แบบประเมิน', section: '', minRole: 'ADMIN' },
        { href: '/admin/invoices', icon: FileText, label: 'ใบกำกับภาษี', section: 'รายงาน', minRole: 'ADMIN' },
        { href: '/admin/invoice-report', icon: FileText, label: 'รวมใบกำกับภาษี', section: '', minRole: 'ADMIN' },
        { href: '/admin/reports', icon: BarChart3, label: 'สรุปการจอง', section: '', minRole: 'ADMIN' },
        { href: '/admin/teacher-report', icon: BookOpen, label: 'ชั่วโมงสอน', section: '', minRole: 'ADMIN' },
        { href: '/admin/availability', icon: Clock, label: 'ตรวจสอบเวลาว่าง', section: '', minRole: 'STAFF' },
        { href: '/admin/users', icon: Shield, label: 'ผู้ใช้งาน', section: 'ระบบ', minRole: 'SUPERUSER' },
        { href: '/admin/logs', icon: FileText, label: 'บันทึกการใช้งาน', section: '', minRole: 'SUPERUSER' },
        { href: '/admin/settings', icon: Settings, label: 'ตั้งค่าเว็บไซต์', section: '', minRole: 'SUPERUSER' },
    ]

    // Filter nav items by user role
    const navItems = user ? allNavItems.filter(item => hasMinRole(user.role, item.minRole)) : allNavItems

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
                <div className="admin-sidebar-header" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="admin-sidebar-logo">S</div>
                        <div>
                            <div className="admin-sidebar-title">SKIBKK</div>
                            <div className="admin-sidebar-subtitle">Admin Panel</div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            const today = new Date()
                            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                            router.push(`/admin/calendar?date=${dateStr}`)
                            if (window.innerWidth <= 1024) setSidebarOpen(false)
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            background: 'linear-gradient(135deg, var(--a-primary), #818cf8)',
                            color: '#fff', border: 'none', borderRadius: '8px',
                            padding: '6px 12px', cursor: 'pointer', fontSize: '12px',
                            fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s',
                            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                            whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 3px 12px rgba(99, 102, 241, 0.5)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.3)' }}
                    >
                        <Home size={14} />
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
