import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { requireDeviceRequest } from "@/server/devices/auth"
import { mapDeviceError } from "@/server/devices/http"
import { mapReplayServiceError } from "@/server/replays/http"
import { completeReplayFromEdge } from "@/server/replays/edge-completion"

const bodySchema = z.object({
  checksumSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
  sizeBytes: z.number().int().positive().optional(),
  replayRequestId: z.string().uuid().optional(),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ mediaId: string }> },
) {
  try {
    const auth = await requireDeviceRequest(req)
    const { mediaId } = await context.params
    const body = bodySchema.parse(await req.json())

    const result = await completeReplayFromEdge({
      tenantId: auth.device.tenantId,
      deviceId: auth.device.id,
      mediaId,
      replayRequestId: body.replayRequestId,
      checksumSha256: body.checksumSha256 ?? null,
      sizeBytes: body.sizeBytes ?? null,
      correlationId: auth.context.correlationId,
    })

    return Response.json({
      data: {
        replay: {
          id: result.replayId,
          status: result.status,
        },
        replayRequest: {
          id: result.replayRequestId,
          status: result.status,
        },
        media: {
          id: result.mediaId,
          status: result.status,
        },
        idempotent: result.idempotent,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === "ReplayServiceError") {
      return mapReplayServiceError(error)
    }

    return mapDeviceError(error)
  }
}
