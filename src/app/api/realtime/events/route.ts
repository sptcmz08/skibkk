import { NextRequest } from 'next/server'
import { subscribeRealtimeEvent, type RealtimeEventPayload } from '@/lib/realtime-events'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function toSseMessage(event: RealtimeEventPayload) {
    return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

export async function GET(req: NextRequest) {
    const encoder = new TextEncoder()

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const send = (event: RealtimeEventPayload) => {
                controller.enqueue(encoder.encode(toSseMessage(event)))
            }

            const unsubscribe = subscribeRealtimeEvent(send)

            controller.enqueue(encoder.encode(`retry: 2000\n\n`))
            controller.enqueue(encoder.encode(`event: connected\ndata: {"ok":true}\n\n`))

            const heartbeat = setInterval(() => {
                controller.enqueue(encoder.encode(`: ping\n\n`))
            }, 15000)

            req.signal.addEventListener('abort', () => {
                clearInterval(heartbeat)
                unsubscribe()
                try {
                    controller.close()
                } catch { /* ignore */ }
            })
        },
        cancel() {
            // connection cleanup is handled by abort listener above
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    })
}
