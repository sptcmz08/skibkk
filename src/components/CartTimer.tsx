'use client'

import { useEffect, useState, useRef } from 'react'
import { Timer, X } from 'lucide-react'
import { getSessionId } from '@/lib/session'
import toast from 'react-hot-toast'

export default function CartTimer() {
    // Store absolute expiry time from server — better than storing seconds
    const [expiresAt, setExpiresAt] = useState<Date | null>(null)
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
    const [dismissed, setDismissed] = useState(false)
    const toastedRef = useRef(false)

    // ── Poll server every 5s for the lock expiry ──────────────────────────────
    useEffect(() => {
        const check = async () => {
            const sessionId = getSessionId()
            if (!sessionId) return
            try {
                const res = await fetch(`/api/locks/check?sessionId=${sessionId}`)
                const data = await res.json()
                if (data.active && data.expiresAt) {
                    setExpiresAt(new Date(data.expiresAt))
                    setDismissed(false)
                    toastedRef.current = false
                } else {
                    setExpiresAt(null)
                }
            } catch { /* ignore */ }
        }
        check() // run immediately on mount
        const id = setInterval(check, 5000)
        return () => clearInterval(id)
    }, []) // ← empty deps, runs once on mount only

    // ── Compute countdown every second from expiresAt ─────────────────────────
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

        tick() // compute immediately
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [expiresAt]) // restarts when server provides new expiresAt

    if (dismissed || secondsLeft === null || secondsLeft <= 0) return null

    const mins = Math.floor(secondsLeft / 60)
    const secs = secondsLeft % 60
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    const isUrgent = secondsLeft < 120

    return (
        <div style={{
            background: isUrgent ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)',
            borderBottom: `1px solid ${isUrgent ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.25)'}`,
            padding: '8px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            fontSize: '13px', fontWeight: 600,
        }}>
            <Timer size={15} style={{ color: isUrgent ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
            <span style={{ color: isUrgent ? '#fca5a5' : '#fcd34d' }}>เวลา Lock สล็อต — หมดใน</span>
            <span style={{
                fontFamily: "'Inter', monospace",
                fontSize: '17px', fontWeight: 800,
                color: isUrgent ? '#ef4444' : '#f59e0b',
                letterSpacing: '2px', minWidth: '52px', textAlign: 'center',
                animation: isUrgent ? 'timerPulse 1s infinite' : 'none',
            }}>
                {timeStr}
            </span>
            <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '2px', marginLeft: '8px', display: 'flex' }}>
                <X size={14} />
            </button>
            <style>{`@keyframes timerPulse { 0%,100%{opacity:1} 50%{opacity:0.55} }`}</style>
        </div>
    )
}
