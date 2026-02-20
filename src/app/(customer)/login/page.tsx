'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
    const router = useRouter()
    const [form, setForm] = useState({ email: '', password: '' })
    const [showPw, setShowPw] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'เข้าสู่ระบบไม่สำเร็จ')
                return
            }
            toast.success('เข้าสู่ระบบสำเร็จ')
            if (data.user.role !== 'CUSTOMER') {
                router.push('/admin')
            } else {
                router.push('/courts')
            }
            router.refresh()
        } catch {
            toast.error('เกิดข้อผิดพลาด')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: 'calc(100vh - 70px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Background effects */}
            <div style={{ position: 'absolute', top: '20%', right: '20%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(102,126,234,0.1), transparent)', filter: 'blur(60px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '20%', left: '20%', width: '250px', height: '250px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(118,75,162,0.08), transparent)', filter: 'blur(50px)', pointerEvents: 'none' }} />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    width: '100%',
                    maxWidth: '440px',
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                <div className="glass-card" style={{ cursor: 'default', padding: '40px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            background: 'var(--c-gradient)',
                            borderRadius: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px',
                            fontSize: '28px',
                        }}>
                            🏟️
                        </div>
                        <h1 style={{
                            fontSize: '28px',
                            fontWeight: 800,
                            fontFamily: "'Inter', sans-serif",
                            letterSpacing: '-0.5px',
                            marginBottom: '8px',
                        }}>
                            เข้าสู่ระบบ
                        </h1>
                        <p style={{ color: 'var(--c-text-secondary)', fontSize: '15px' }}>
                            กรุณาเข้าสู่ระบบเพื่อจองสนามกีฬา
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <div className="input-group">
                            <label>อีเมล</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-muted)' }} />
                                <input
                                    type="email"
                                    className="input-field"
                                    style={{ paddingLeft: '42px', width: '100%' }}
                                    placeholder="your@email.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>รหัสผ่าน</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-muted)' }} />
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    className="input-field"
                                    style={{ paddingLeft: '42px', paddingRight: '42px', width: '100%' }}
                                    placeholder="••••••••"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--c-text-muted)', cursor: 'pointer' }}
                                >
                                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={loading}
                            style={{ marginTop: '8px', padding: '14px' }}
                        >
                            {loading ? <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} /> : <><LogIn size={18} /> เข้าสู่ระบบ</>}
                        </motion.button>
                    </form>

                    <div style={{
                        textAlign: 'center',
                        marginTop: '24px',
                        color: 'var(--c-text-secondary)',
                        fontSize: '14px',
                    }}>
                        ยังไม่มีบัญชี?{' '}
                        <Link href="/register" style={{ color: 'var(--c-primary-light)', textDecoration: 'none', fontWeight: 600 }}>
                            สมัครสมาชิก
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
