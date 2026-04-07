// Per-browser session ID for slot locking (no login required).
// Admin and customer flows intentionally use different storage keys
// so locks are visible across the two UIs even in the same browser.
export function getSessionId(scope: 'customer' | 'admin' = 'customer'): string {
    if (typeof window === 'undefined') return ''
    const storageKey = scope === 'admin' ? 'skibkk-session-id-admin' : 'skibkk-session-id'
    let id = localStorage.getItem(storageKey)
    if (!id) {
        id = crypto.randomUUID()
        localStorage.setItem(storageKey, id)
    }
    return id
}
