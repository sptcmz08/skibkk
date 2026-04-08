'use client'

export interface CartItem {
    courtId: string
    courtName: string
    date: string
    startTime: string
    endTime: string
    price: number
}

interface LockInfo {
    courtId: string
    date: string
    startTime: string
    expiresAt?: string
}

interface LockCheckResponse {
    active?: boolean
    expiresAt?: string
    secondsLeft?: number
    locks?: LockInfo[]
}

const CART_KEY = 'skibkk-cart'
const BOOKING_DRAFT_KEY = 'skibkk-booking-draft'

const cartItemKey = (item: Pick<CartItem, 'courtId' | 'date' | 'startTime'>) =>
    `${item.courtId}__${item.date}__${item.startTime}`

export const readStoredCart = (): CartItem[] => {
    try {
        const raw = localStorage.getItem(CART_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

export const writeStoredCart = (items: CartItem[]) => {
    localStorage.setItem(CART_KEY, JSON.stringify(items))
    window.dispatchEvent(new Event('cart-updated'))
}

export const clearStoredCart = (options?: { clearDraft?: boolean }) => {
    localStorage.setItem(CART_KEY, '[]')
    if (options?.clearDraft) {
        localStorage.removeItem(BOOKING_DRAFT_KEY)
    }
    window.dispatchEvent(new Event('cart-updated'))
}

export async function syncCartWithServerLocks(sessionId: string | null) {
    const cart = readStoredCart()
    if (!cart.length) {
        return { cart: [], active: false, changed: false, expiresAt: null as Date | null, removedCount: 0 }
    }

    if (!sessionId) {
        clearStoredCart({ clearDraft: true })
        return { cart: [], active: false, changed: true, expiresAt: null as Date | null, removedCount: cart.length }
    }

    const res = await fetch(`/api/locks/check?sessionId=${sessionId}`, { cache: 'no-store' })
    const data = await res.json() as LockCheckResponse
    const activeLocks = Array.isArray(data.locks) ? data.locks : []

    if (!data.active || activeLocks.length === 0) {
        clearStoredCart({ clearDraft: true })
        return {
            cart: [],
            active: false,
            changed: cart.length > 0,
            expiresAt: null as Date | null,
            removedCount: cart.length,
        }
    }

    const activeLockKeys = new Set(activeLocks.map(lock => cartItemKey(lock)))
    const syncedCart = cart.filter(item => activeLockKeys.has(cartItemKey(item)))
    const changed = syncedCart.length !== cart.length

    if (changed) {
        if (syncedCart.length > 0) {
            writeStoredCart(syncedCart)
        } else {
            clearStoredCart({ clearDraft: true })
        }
    }

    return {
        cart: syncedCart,
        active: true,
        changed,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        removedCount: cart.length - syncedCart.length,
    }
}
