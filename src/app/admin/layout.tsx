'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
    LayoutDashboard, MapPin, DollarSign, Package, Calendar,
    Users, GraduationCap, FileText, BarChart3, Clock, Shield,
    LogOut, Menu, X, ChevronDown, Settings
} from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [user, setUser] = useState<{ name: string; role: string } | null>(null)

    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(d => {
                if (d.user && ['ADMIN', 'SUPERUSER', 'STAFF'].includes(d.user.role)) {
                    setUser(d.user)
                } else {
                    router.push('/login')
                }
            })
            .catch(() => router.push('/login'))
    }, [router])

    const navItems = [
        { href: '/admin', icon: LayoutDashboard, label: 'แดชบอร์ด', section: '' },
        { href: '/admin/courts', icon: MapPin, label: 'จัดการสนาม', section: 'จัดการ' },
        { href: '/admin/pricing', icon: DollarSign, label: 'กำหนดราคา', section: '' },
        { href: '/admin/packages', icon: Package, label: 'แพ็คเกจ', section: '' },
        { href: '/admin/calendar', icon: Calendar, label: 'ปฏิทินการจอง', section: 'การจอง' },
        { href: '/admin/customers', icon: Users, label: 'ลูกค้า', section: '' },
        { href: '/admin/teachers', icon: GraduationCap, label: 'ครูผู้สอน', section: 'บุคลากร' },
        { href: '/admin/invoices', icon: FileText, label: 'ใบกำกับภาษี', section: 'รายงาน' },
        { href: '/admin/reports', icon: BarChart3, label: 'สรุปการจอง', section: '' },
        { href: '/admin/availability', icon: Clock, label: 'ตรวจสอบเวลาว่าง', section: '' },
        { href: '/admin/users', icon: Shield, label: 'ผู้ใช้งาน', section: 'ระบบ' },
        { href: '/admin/settings', icon: Settings, label: 'ตั้งค่าเว็บไซต์', section: '' },
    ]

    const getPageTitle = () => {
        const item = navItems.find(n => n.href === pathname)
        return item?.label || 'แดชบอร์ด'
    }

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
    }

    // Group items by section
    let currentSection = ''

    if (!user) return <div className="loading-page" style={{ background: 'var(--a-bg)' }}><div className="spinner" style={{ borderTopColor: 'var(--a-primary)' }} /></div>

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="admin-sidebar-header">
                    <div className="admin-sidebar-logo">S</div>
                    <div>
                        <div className="admin-sidebar-title">SKIBKK</div>
                        <div className="admin-sidebar-subtitle">Admin Panel</div>
                    </div>
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
                                    onClick={() => setSidebarOpen(false)}
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
            <div className="admin-content">
                <header className="admin-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="hamburger"
                            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text)' }}
                        >
                            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                        <h1 className="admin-topbar-title">{getPageTitle()}</h1>
                    </div>
                    <div className="admin-topbar-actions">
                        <Link href="/" style={{ fontSize: '13px', color: 'var(--a-text-secondary)', textDecoration: 'none' }}>
                            🌐 ดูหน้าเว็บไซต์
                        </Link>
                    </div>
                </header>

                <main className="admin-page">
                    {children}
                </main>
            </div>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    onClick={() => setSidebarOpen(false)}
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.5)', zIndex: 49,
                    }}
                />
            )}
        </div>
    )
}
