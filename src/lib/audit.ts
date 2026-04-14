import type { NextRequest } from 'next/server'

export function getClientIp(req: NextRequest) {
    const cfIp = req.headers.get('cf-connecting-ip')
    if (cfIp) return cfIp

    const realIp = req.headers.get('x-real-ip')
    if (realIp) return realIp

    const forwardedFor = req.headers.get('x-forwarded-for')
    if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || null

    const forwarded = req.headers.get('forwarded')
    const forwardedMatch = forwarded?.match(/for="?([^;,"]+)/i)
    return forwardedMatch?.[1] || null
}

export function getAuditRequestMeta(req: NextRequest) {
    const url = new URL(req.url)
    return {
        ipAddress: getClientIp(req),
        userAgent: req.headers.get('user-agent') || null,
        method: req.method,
        path: `${url.pathname}${url.search}`,
        referer: req.headers.get('referer') || null,
        origin: req.headers.get('origin') || null,
    }
}
