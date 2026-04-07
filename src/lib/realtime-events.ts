type RealtimeEventType =
    | 'lock_changed'
    | 'booking_created'
    | 'booking_updated'
    | 'booking_cancelled'

export interface RealtimeEventPayload {
    type: RealtimeEventType
    bookingId?: string
    bookingNumber?: string
    status?: string
    source?: 'customer' | 'admin' | 'system'
    affectedDates?: string[]
    courtIds?: string[]
    venueIds?: string[]
    sessionId?: string
    message?: string
    timestamp: string
}

type RealtimeListener = (event: RealtimeEventPayload) => void

const globalRealtime = globalThis as typeof globalThis & {
    __skibkkRealtimeListeners?: Set<RealtimeListener>
}

function getListenerSet() {
    if (!globalRealtime.__skibkkRealtimeListeners) {
        globalRealtime.__skibkkRealtimeListeners = new Set<RealtimeListener>()
    }
    return globalRealtime.__skibkkRealtimeListeners
}

export function publishRealtimeEvent(event: Omit<RealtimeEventPayload, 'timestamp'>) {
    const payload: RealtimeEventPayload = {
        ...event,
        timestamp: new Date().toISOString(),
    }

    for (const listener of getListenerSet()) {
        try {
            listener(payload)
        } catch (error) {
            console.error('Realtime listener error:', error)
        }
    }
}

export function subscribeRealtimeEvent(listener: RealtimeListener) {
    const listeners = getListenerSet()
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}
