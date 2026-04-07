'use client'

import { useEffect, useRef } from 'react'
import type { RealtimeEventPayload } from './realtime-events'

export function useRealtimeEvents(onEvent: (event: RealtimeEventPayload) => void) {
    const onEventRef = useRef(onEvent)

    useEffect(() => {
        onEventRef.current = onEvent
    }, [onEvent])

    useEffect(() => {
        const source = new EventSource('/api/realtime/events')

        const handler = (message: MessageEvent) => {
            try {
                onEventRef.current(JSON.parse(message.data) as RealtimeEventPayload)
            } catch {
                // ignore malformed messages
            }
        }

        source.addEventListener('lock_changed', handler)
        source.addEventListener('booking_created', handler)
        source.addEventListener('booking_updated', handler)
        source.addEventListener('booking_cancelled', handler)

        return () => {
            source.removeEventListener('lock_changed', handler)
            source.removeEventListener('booking_created', handler)
            source.removeEventListener('booking_updated', handler)
            source.removeEventListener('booking_cancelled', handler)
            source.close()
        }
    }, [])
}
