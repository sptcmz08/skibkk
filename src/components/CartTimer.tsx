'use client'

import { useEffect, useState, useCallback } from 'react'
import { Timer, X } from 'lucide-react'
import { getSessionId } from '@/lib/session'
import toast from 'react-hot-toast'

export default function CartTimer() {
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
    const [visible, setVisible] = useState(false)

    const checkLocks = useCallback(async () => {
        const sessionId = getSessionId()
        if (!sessionId) return

        try {
            const res = await fetch(`/api/locks/check?sessionId=${sessionId}`)
            const data = await res.json()
            if (data.active && data.secondsLeft > 0) {
                setSecondsLeft(data.secondsLeft)
                setVisible(true)
            } else if (secondsLeft !== null && secondsLeft > 0) {
                // Was active but now expired — clear cart
                setSecondsLeft(0)
                setVisible(false)
                localStorage.removeItem('skibkk-cart')
                window.dispatchEvent(new Event('cart-updated'))
                toast('⏰ หมดเวลา Lock สล็อต ตะกร้าถูกล้างแล้ว กรุณาเลือกใหม่', {
                    duration: 6000,
                    style: { background: '#1f1f40', color: '#fff', border: '1px solid rgba(239,68,68,0.4)' },
                    icon: '🔓',
                })
            } else {
                setVisible(false)
                setSecondsLeft(null)
            }
        } catch { /* ignore */ }
    }, [secondsLeft])

    // Poll every 5s to sync with DB
    useEffect(() => {
        checkLocks()
        const interval = setInterval(checkLocks, 5000)
        return () => clearInterval(interval)
    }, [checkLocks])

    // Client-side countdown every second
    useEffect(() => {
        if (secondsLeft === null || secondsLeft <= 0) return
        const tick = setInterval(() => {
            setSecondsLeft(s => {
                if (s === null || s <= 1) { clearInterval(tick); return 0 }
                return s - 1
            })
        }, 1000)
        return () => clearInterval(tick)
    }, [secondsLeft])

    if (!visible || secondsLeft === null || secondsLeft <= 0) return null

    const mins = Math.floor(secondsLeft / 60)
    const secs = secondsLeft % 60
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    const isUrgent = secondsLeft < 120 // last 2 minutes = red

    return (
        <div style={{
            background: isUrgent ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)',
            borderBottom: `1px solid ${isUrgent ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)'}`,
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: 600,
        }}>
            <Timer size={15} style={{ color: isUrgent ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
            <span style={{ color: isUrgent ? '#fca5a5' : '#fcd34d' }}>
                เวลา Lock สล็อต — หมดใน
            </span>
            <span style={{
                fontFamily: "'Inter', monospace",
                fontSize: '16px',
                fontWeight: 800,
                color: isUrgent ? '#ef4444' : '#f59e0b',
                letterSpacing: '1px',
                minWidth: '50px',
                textAlign: 'center',
                animation: isUrgent ? 'pulse 1s infinite' : 'none',
            }}>
                {timeStr}
            </span>
            <button
                onClick={() => setVisible(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '2px', marginLeft: '8px', display: 'flex' }}
                title="ซ่อน"
            >
                <X size={14} />
            </button>

            <style>{`
                @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.6 } }
            `}</style>
        </div>
    )
}
