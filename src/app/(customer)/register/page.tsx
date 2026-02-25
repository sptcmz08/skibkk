'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, User, Phone, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RegisterPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const returnUrl = searchParams.get('returnUrl') || '/courts'
    const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '' })
    const [showPw, setShowPw] = useState(false)
    const [loading, setLoading] = useState(false)
    const [logoUrl, setLogoUrl] = useState('/logo.png')

    useEffect(() => {
        fetch('/api/settings', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => { if (data.logo) setLogoUrl(data.logo) })
            .catch(() => { })
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (form.password !== form.confirmPassword) {
            toast.error('รหัสผ่านไม่ตรงกัน')
            return
        }
        setLoading(true)
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: form.name, email: form.email, password: form.password, phone: form.phone }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'สมัครสมาชิกไม่สำเร็จ')
                return
            }
            toast.success('สมัครสมาชิกสำเร็จ!')
            router.push(returnUrl)
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
            <div style={{ position: 'absolute', top: '15%', left: '15%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(253,203,110,0.1), transparent)', filter: 'blur(60px)', pointerEvents: 'none' }} />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}
            >
                <div className="glass-card" style={{ cursor: 'default', padding: '40px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <img src={logoUrl} alt="SKIBKK" style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '16px',
                            objectFit: 'contain',
                            margin: '0 auto 16px',
                            display: 'block',
                        }} />
                        <h1 style={{ fontSize: '28px', fontWeight: 800, fontFamily: "'Inter', sans-serif", letterSpacing: '-0.5px', marginBottom: '8px' }}>
                            สมัครสมาชิก
                        </h1>
                        <p style={{ color: 'var(--c-text-secondary)', fontSize: '15px' }}>
                            สร้างบัญชีเพื่อเริ่มต้นจองสนามกีฬา
                        </p>
                    </div>

                    {/* LINE Signup */}
                    <a
                        href={`/api/auth/line?returnUrl=${encodeURIComponent(returnUrl)}`}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                            padding: '14px', borderRadius: '12px', cursor: 'pointer',
                            background: '#06C755', color: 'white', fontWeight: 700, fontSize: '16px',
                            textDecoration: 'none', border: 'none', width: '100%',
                            transition: 'opacity 0.2s',
                        }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" /></svg>
                        สมัครสมาชิกด้วย LINE
                    </a>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '4px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                        <span style={{ fontSize: '13px', color: 'var(--c-text-muted)' }}>หรือ</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="input-group">
                            <label>ชื่อ-สกุล</label>
                            <div style={{ position: 'relative' }}>
                                <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-muted)' }} />
                                <input
                                    type="text"
                                    className="input-field"
                                    style={{ paddingLeft: '42px', width: '100%' }}
                                    placeholder="ชื่อ นามสกุล"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

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
                            <label>เบอร์โทรศัพท์ *</label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-muted)' }} />
                                <input
                                    type="tel"
                                    className="input-field"
                                    style={{ paddingLeft: '42px', width: '100%' }}
                                    placeholder="08x-xxx-xxxx"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
                                    placeholder="อย่างน้อย 6 ตัวอักษร"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    required
                                    minLength={6}
                                />
                                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--c-text-muted)', cursor: 'pointer' }}>
                                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="input-group">
                            <label>ยืนยันรหัสผ่าน</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-muted)' }} />
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    className="input-field"
                                    style={{ paddingLeft: '42px', width: '100%' }}
                                    placeholder="ยืนยันรหัสผ่าน"
                                    value={form.confirmPassword}
                                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            className="btn btn-accent btn-block"
                            disabled={loading}
                            style={{ marginTop: '8px', padding: '14px' }}
                        >
                            {loading ? <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} /> : <><UserPlus size={18} /> สมัครสมาชิก</>}
                        </motion.button>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: '24px', color: 'var(--c-text-secondary)', fontSize: '14px' }}>
                        มีบัญชีแล้ว?{' '}
                        <Link href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`} style={{ color: 'var(--c-primary-light)', textDecoration: 'none', fontWeight: 600 }}>
                            เข้าสู่ระบบ
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
