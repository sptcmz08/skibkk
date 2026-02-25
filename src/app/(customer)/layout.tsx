'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ShoppingCart, User, Menu, X, LogOut } from 'lucide-react'
import CartTimer from '@/components/CartTimer'

export default function CustomerLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()
    const [cartCount, setCartCount] = useState(0)
    const [user, setUser] = useState<{ name: string; email: string } | null>(null)
    const [menuOpen, setMenuOpen] = useState(false)
    const [logoUrl, setLogoUrl] = useState('/logo.png')

    useEffect(() => {
        // Load cart from localStorage
        const cart = JSON.parse(localStorage.getItem('skibkk-cart') || '[]')
        setCartCount(cart.length)

        // Check auth
        fetch('/api/auth/me', { cache: 'no-store' })
            .then((r) => r.ok ? r.json() : null)
            .then((data) => { if (data?.user) setUser(data.user) })
            .catch(() => { })

        // Load site settings (logo)
        fetch('/api/settings', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => { if (data.logo) setLogoUrl(data.logo) })
            .catch(() => { })

        // Listen for cart updates
        const handleCartUpdate = () => {
            const c = JSON.parse(localStorage.getItem('skibkk-cart') || '[]')
            setCartCount(c.length)
        }
        window.addEventListener('cart-updated', handleCartUpdate)
        return () => window.removeEventListener('cart-updated', handleCartUpdate)
    }, [])



    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        setUser(null)
        window.location.href = '/courts'
    }

    return (
        <div className="customer-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <nav className="customer-nav">
                <Link href="/courts" className="logo">
                    <img src={logoUrl} alt="SKIBKK" style={{ height: '48px', width: 'auto', borderRadius: '8px', objectFit: 'contain' }} />
                </Link>



                <div className="nav-actions">
                    <CartTimer />
                    <Link href="/cart" className="cart-btn">
                        <ShoppingCart size={20} />
                        {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
                    </Link>

                    {user ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Link href="/profile" className="btn btn-secondary btn-sm">
                                <User size={16} />
                                {user.name}
                            </Link>
                            <button onClick={handleLogout} className="btn btn-sm" style={{ background: 'transparent', color: 'var(--c-text-secondary)', border: 'none', cursor: 'pointer', padding: '8px' }}>
                                <LogOut size={18} />
                            </button>
                        </div>
                    ) : (
                        <Link href="/login" className="btn btn-primary btn-sm">
                            เข้าสู่ระบบ
                        </Link>
                    )}

                    <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
                        {menuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </nav>

            {/* Mobile menu */}
            {menuOpen && (
                <div style={{
                    position: 'fixed',
                    top: '70px',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(10, 10, 26, 0.95)',
                    backdropFilter: 'blur(20px)',
                    zIndex: 99,
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                }}>

                    <div style={{ borderTop: '1px solid var(--c-border)', margin: '12px 0' }} />
                    {user ? (
                        <>
                            <Link href="/profile" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', color: 'var(--c-text)', textDecoration: 'none', fontSize: '18px', fontWeight: 600, borderRadius: '12px' }}>
                                <User size={22} /> โปรไฟล์
                            </Link>
                            <button onClick={() => { handleLogout(); setMenuOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', color: 'var(--c-danger)', background: 'none', border: 'none', fontSize: '18px', fontWeight: 600, cursor: 'pointer', borderRadius: '12px', width: '100%', textAlign: 'left' }}>
                                <LogOut size={22} /> ออกจากระบบ
                            </button>
                        </>
                    ) : (
                        <Link href="/login" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', color: 'var(--c-primary)', textDecoration: 'none', fontSize: '18px', fontWeight: 600, borderRadius: '12px' }}>
                            <User size={22} /> เข้าสู่ระบบ
                        </Link>
                    )}
                </div>
            )}

            <main className="customer-main" style={{ flex: 1 }}>
                {children}
            </main>

            {/* Footer */}
            <footer style={{
                background: 'var(--c-bg-secondary)',
                borderTop: '1px solid var(--c-border)',
                padding: '40px 24px',
                textAlign: 'center',
                color: 'var(--c-text-muted)',
                fontSize: '14px',
            }}>
                <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontWeight: 700, background: 'var(--c-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>SKIBKK</span>
                    <span style={{ margin: '0 8px' }}>•</span>
                    ระบบจองสนามกีฬาออนไลน์
                </div>
                <div>© 2026 SKIBKK. All rights reserved.</div>
            </footer>
        </div>
    )
}
