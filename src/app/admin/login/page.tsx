'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Mail, Lock, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminLoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !password) { toast.error('กรุณากรอกอีเมลและรหัสผ่าน'); return }
        setLoading(true)
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })
            const data = await res.json()
            if (res.ok) {
                if (['ADMIN', 'SUPERUSER', 'STAFF'].includes(data.user?.role)) {
                    toast.success('เข้าสู่ระบบสำเร็จ')
                    window.location.href = '/admin'
                } else {
                    toast.error('บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบหลังบ้าน')
                }
            } else {
                toast.error(data.error || 'เข้าสู่ระบบไม่สำเร็จ')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาด')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--a-bg)',
            padding: '24px',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '420px',
                background: 'white',
                borderRadius: '16px',
                padding: '40px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                border: '1px solid var(--a-border)',
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '16px',
                        background: 'var(--a-primary)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px', fontWeight: 800, color: 'white',
                    }}>S</div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--a-text)', marginBottom: '4px' }}>
                        SKIBKK Admin
                    </h1>
                    <p style={{ color: 'var(--a-text-secondary)', fontSize: '14px' }}>
                        เข้าสู่ระบบหลังบ้าน
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--a-text-secondary)', marginBottom: '6px' }}>
                            อีเมล
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--a-text-muted)' }} />
                            <input
                                type="email"
                                className="admin-input"
                                placeholder="admin@skibkk.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                style={{ paddingLeft: '40px' }}
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--a-text-secondary)', marginBottom: '6px' }}>
                            รหัสผ่าน
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--a-text-muted)' }} />
                            <input
                                type="password"
                                className="admin-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                style={{ paddingLeft: '40px' }}
                                autoComplete="current-password"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-admin"
                        style={{
                            width: '100%',
                            padding: '14px',
                            fontSize: '15px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            fontFamily: 'inherit',
                        }}
                    >
                        {loading ? (
                            <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', borderTopColor: 'white' }} />
                        ) : (
                            <>
                                <LogIn size={18} />
                                เข้าสู่ระบบ
                            </>
                        )}
                    </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <a href="/courts" style={{ fontSize: '13px', color: 'var(--a-text-muted)', textDecoration: 'none' }}>
                        ← กลับไปหน้าเว็บไซต์
                    </a>
                </div>
            </div>
        </div>
    )
}
