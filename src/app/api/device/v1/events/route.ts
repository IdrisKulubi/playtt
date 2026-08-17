import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { requireDeviceRequest } from "@/server/devices/auth"
import { mapDeviceError } from "@/server/devices/http"
import { ingestScoreEvent } from "@/server/scoring/ingest"
import { runDurableWorkCycle } from "@/server/workers/run-durable-work"

const scoreEventSchema = z.object({
  bootId: z.string().trim().min(1),
  sequence: z.number().int().positive(),
  kind: z.enum(["point", "correction"]),
  side: z.enum(["a", "b"]),
  delta: z.number().int().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDeviceRequest(req)
    const body = scoreEventSchema.parse(await req.json())

    const result = await ingestScoreEvent({
      tenantId: auth.device.tenantId,
      device: auth.device,
      bootId: body.bootId,
      sequence: body.sequence,
      kind: body.kind,
      side: body.side,
      delta: body.delta,
      correlationId: auth.context.correlationId,
    })

    if (!result.duplicate) {
      void runDurableWorkCycle().catch((error) => {
        console.error("Failed to drain durable work after score ingest", error)
      })
    }

    return Response.json({
      data: {
        snapshotVersion: result.snapshotVersion,
        state: result.state,
        duplicate: result.duplicate,
        eventId: result.eventId,
      },
    })
  } catch (error) {
    return mapDeviceError(error)
  }
}
