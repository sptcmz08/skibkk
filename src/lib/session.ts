// Per-browser session ID for slot locking (no login required)
export function getSessionId(): string {
    if (typeof window === 'undefined') return ''
    let id = localStorage.getItem('skibkk-session-id')
    if (!id) {
        id = crypto.randomUUID()
        localStorage.setItem('skibkk-session-id', id)
    }
    return id
}
