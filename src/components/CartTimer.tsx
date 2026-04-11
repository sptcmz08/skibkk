'use client'

import { useEffect, useState, useRef } from 'react'
import { Timer } from 'lucide-react'
import { getSessionId } from '@/lib/session'
import toast from 'react-hot-toast'
import { useRealtimeEvents } from '@/lib/use-realtime-events'
import { syncCartWithServerLocks } from '@/lib/cart'

export default function CartTimer() {
    const [expiresAt, setExpiresAt] = useState<Date | null>(null)
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
    const toastedRef = useRef(false)
    const checkLocksRef = useRef<(() => Promise<void>) | null>(null)
    const invalidCartToastRef = useRef(false)

    // Poll server every 5s for the lock expiry
    useEffect(() => {
        const check = async () => {
            const sessionId = getSessionId()
            try {
                const result = await syncCartWithServerLocks(sessionId)
                if (result.active && result.expiresAt) {
                    setExpiresAt(result.expiresAt)
                    toastedRef.current = false
                    if (result.changed && result.removedCount > 0 && !invalidCartToastRef.current) {
                        invalidCartToastRef.current = true
                        toast('ระบบลบรายการที่หมดเวลา หรือถูกจองไปแล้ว ออกจากตะกร้าให้แล้ว', {
                            duration: 4500,
                            icon: '🧹',
                        })
                    }
                } else {
                    setExpiresAt(null)
                    setSecondsLeft(null)
                    if (result.changed && result.removedCount > 0 && !toastedRef.current) {
                        toastedRef.current = true
                        toast('หมดเวลา 20 นาที ระบบล้างตะกร้าให้อัตโนมัติแล้ว', {
                            duration: 5000,
                            icon: '⏰',
                        })
                    }
                }
            } catch (err) {
                console.error('[CartTimer] Error:', err)
            }
        }
        checkLocksRef.current = check
        check()
        const id = setInterval(check, 5000)
        return () => clearInterval(id)
    }, [])

    useRealtimeEvents((event) => {
        if (event.type === 'lock_changed' && event.sessionId === getSessionId()) {
            checkLocksRef.current?.().catch(() => { })
        }
    })

    // Compute countdown every second from expiresAt
    useEffect(() => {
        if (!expiresAt) {
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
                setSecondsLeft(null)
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
            background: isUrgent ? 'rgba(239,68,68,0.15)' : 'rgba(250,204,21,0.12)',
            border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.3)' : 'rgba(250,204,21,0.35)'}`,
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            animation: isUrgent ? 'timerPulse 1s infinite' : 'none',
        }}>
            <Timer size={14} style={{ color: isUrgent ? '#ef4444' : '#EAB308', flexShrink: 0 }} />
            <span style={{ color: isUrgent ? '#fca5a5' : '#B38600', fontSize: '12px' }}>Lock</span>
            <span style={{
                fontFamily: "'Inter', monospace",
                fontSize: '14px',
                fontWeight: 800,
                color: isUrgent ? '#ef4444' : '#EAB308',
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
