import { type NextRequest } from "next/server"

import { getRealtimeAdapter } from "@/server/realtime/broadcaster"
import { getDisplaySnapshotForResource } from "@/server/realtime/display-query"
import { resourceChannel } from "@/server/realtime/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ resourceId: string }>
}

const HEARTBEAT_MS = 15_000

export async function GET(req: NextRequest, routeContext: RouteContext) {
  const { resourceId } = await routeContext.params
  const display = await getDisplaySnapshotForResource(resourceId)

  if (!display) {
    return Response.json(
      {
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "We could not find that resource.",
        },
      },
      { status: 404 },
    )
  }

  const encoder = new TextEncoder()
  const channel = resourceChannel(display.resource.tenantId, resourceId)
  const adapter = getRealtimeAdapter()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => {
        controller.enqueue(encoder.encode(payload))
      }

      send(`event: ready\ndata: ${JSON.stringify({ resourceId })}\n\n`)

      const subscription = adapter.subscribe(channel, (hint) => {
        send(`event: score\ndata: ${JSON.stringify(hint)}\n\n`)
      })

      const heartbeat = setInterval(() => {
        send(`: heartbeat ${Date.now()}\n\n`)
      }, HEARTBEAT_MS)

      const close = () => {
        clearInterval(heartbeat)
        subscription.unsubscribe()

        try {
          controller.close()
        } catch {
          // Stream may already be closed.
        }
      }

      req.signal.addEventListener("abort", close, { once: true })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
