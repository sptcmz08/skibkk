'use client'

import { useEffect, useState, useRef } from 'react'
import { Timer } from 'lucide-react'
import { getSessionId } from '@/lib/session'
import toast from 'react-hot-toast'

export default function CartTimer() {
    const [expiresAt, setExpiresAt] = useState<Date | null>(null)
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
    const toastedRef = useRef(false)

    // Poll server every 5s for the lock expiry
    useEffect(() => {
        console.log('[CartTimer] Component mounted')
        const check = async () => {
            const sessionId = getSessionId()
            console.log('[CartTimer] Checking locks for session:', sessionId)
            if (!sessionId) return
            try {
                const res = await fetch(`/api/locks/check?sessionId=${sessionId}`)
                const data = await res.json()
                console.log('[CartTimer] API response:', data)
                if (data.active && data.expiresAt) {
                    setExpiresAt(new Date(data.expiresAt))
                    toastedRef.current = false
                } else {
                    setExpiresAt(null)
                }
            } catch (err) {
                console.error('[CartTimer] Error:', err)
            }
        }
        check()
        const id = setInterval(check, 5000)
        return () => clearInterval(id)
    }, [])

    // Compute countdown every second from expiresAt
    useEffect(() => {
        if (!expiresAt) {
            setSecondsLeft(null)
            return
        }

        const tick = () => {
            const s = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))
            setSecondsLeft(s)
            if (s <= 0 && !toastedRef.current) {
                toastedRef.current = true
                localStorage.removeItem('skibkk-cart')
                window.dispatchEvent(new Event('cart-updated'))
                toast('⏰ หมดเวลา Lock สล็อต — ตะกร้าถูกล้างแล้ว', {
                    duration: 6000,
                    style: { background: '#1f1f40', color: '#fff', border: '1px solid rgba(239,68,68,0.4)' },
                    icon: '🔓',
                })
                setExpiresAt(null)
            }
        }

        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [expiresAt])

    if (secondsLeft === null || secondsLeft <= 0) return null

    const mins = Math.floor(secondsLeft / 60)
    const secs = secondsLeft % 60
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    const isUrgent = secondsLeft < 120

    return (
        <div className="header-timer" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: isUrgent ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.1)',
            border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.25)'}`,
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            animation: isUrgent ? 'timerPulse 1s infinite' : 'none',
        }}>
            <Timer size={14} style={{ color: isUrgent ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
            <span style={{ color: isUrgent ? '#fca5a5' : '#fcd34d', fontSize: '12px' }}>Lock</span>
            <span style={{
                fontFamily: "'Inter', monospace",
                fontSize: '14px',
                fontWeight: 800,
                color: isUrgent ? '#ef4444' : '#f59e0b',
                letterSpacing: '1px',
                minWidth: '42px',
                textAlign: 'center',
            }}>
                {timeStr}
            </span>
            <style>{`@keyframes timerPulse { 0%,100%{opacity:1} 50%{opacity:0.55} }`}</style>
        </div>
    )
}
