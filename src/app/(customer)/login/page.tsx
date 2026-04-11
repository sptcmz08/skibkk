'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const returnUrl = searchParams.get('returnUrl') || '/courts'
    const [logoUrl, setLogoUrl] = useState('/logo.png')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetch('/api/settings', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => { if (data.logo) setLogoUrl(data.logo) })
            .catch(() => { })
    }, [])

    const handleLineLogin = () => {
        setLoading(true)
        const channelId = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID
        if (!channelId) {
            window.location.href = `/api/auth/line?returnUrl=${encodeURIComponent(returnUrl)}`
            return
        }
        const state = btoa(JSON.stringify({ returnUrl }))
        const callbackUrl = `${window.location.origin}/api/auth/line/callback`
        const url = new URL('https://access.line.me/oauth2/v2.1/authorize')
        url.searchParams.set('response_type', 'code')
        url.searchParams.set('client_id', channelId)
        url.searchParams.set('redirect_uri', callbackUrl)
        url.searchParams.set('state', state)
        url.searchParams.set('scope', 'profile openid email')
        url.searchParams.set('bot_prompt', 'aggressive')
        window.location.href = url.toString()
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
            <div style={{ position: 'absolute', top: '20%', right: '20%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(250,204,21,0.1), transparent)', filter: 'blur(60px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '20%', left: '20%', width: '250px', height: '250px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,169,0,0.08), transparent)', filter: 'blur(50px)', pointerEvents: 'none' }} />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}
            >
                <div className="glass-card" style={{ cursor: 'default', padding: '40px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <img src={logoUrl} alt="SKIBKK" style={{
                            width: '80px', height: '80px', borderRadius: '16px',
                            objectFit: 'contain', margin: '0 auto 16px', display: 'block',
                        }} />
                        <h1 style={{
                            fontSize: '28px', fontWeight: 800,
                            fontFamily: "'Inter', sans-serif",
                            letterSpacing: '-0.5px', marginBottom: '8px',
                        }}>
                            เข้าสู่ระบบ
                        </h1>
                        <p style={{ color: 'var(--c-text-secondary)', fontSize: '15px' }}>
                            กรุณาเข้าสู่ระบบด้วย LINE เพื่อจองสนามกีฬา
                        </p>
                    </div>

                    {/* LINE Login — client-side redirect for iOS Universal Links */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={handleLineLogin}
                        disabled={loading}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                            padding: '16px', borderRadius: '14px', cursor: loading ? 'not-allowed' : 'pointer',
                            background: '#06C755', color: 'white', fontWeight: 700, fontSize: '17px',
                            textDecoration: 'none', border: 'none', width: '100%',
                            transition: 'all 0.2s', fontFamily: 'inherit',
                            opacity: loading ? 0.7 : 1,
                            boxShadow: '0 4px 16px rgba(6,199,85,0.3)',
                        }}
                    >
                        {loading ? (
                            <div className="spinner" style={{ width: '22px', height: '22px', borderWidth: '2px', borderTopColor: 'white' }} />
                        ) : (
                            <>
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" /></svg>
                                เข้าสู่ระบบด้วย LINE
                            </>
                        )}
                    </motion.button>

                    <div style={{
                        textAlign: 'center', marginTop: '24px',
                        color: 'var(--c-text-muted)', fontSize: '13px',
                        lineHeight: '1.6',
                    }}>
                        <p style={{ margin: 0 }}>ระบบจะเข้าสู่ระบบผ่าน LINE Account ของคุณ</p>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.7 }}>ปลอดภัย • ไม่ต้องจำรหัสผ่าน • รับแจ้งเตือนผ่าน LINE</p>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
