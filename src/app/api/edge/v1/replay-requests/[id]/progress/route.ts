import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { requireDeviceRequest } from "@/server/devices/auth"
import { mapDeviceError } from "@/server/devices/http"
import { completeReplayFromEdge } from "@/server/replays/edge-completion"
import { mapReplayServiceError } from "@/server/replays/http"
import { updateReplayRequestProgressFromEdge } from "@/server/replays/replay-requests-service"

const progressSchema = z.object({
  status: z.enum([
    "edge_acknowledged",
    "capturing",
    "extracting",
    "uploading",
    "verifying",
    "ready",
    "edge_offline",
    "buffer_missing",
    "extraction_failed",
    "upload_failed",
    "expired",
    "failed",
  ]),
  failureReason: z.string().trim().optional(),
  checksumSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
  sizeBytes: z.number().int().positive().optional(),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireDeviceRequest(req)
    const { id } = await context.params
    const body = progressSchema.parse(await req.json())

    const replayRequest = await updateReplayRequestProgressFromEdge({
      tenantId: auth.device.tenantId,
      deviceId: auth.device.id,
      replayRequestId: id,
      toStatus: body.status,
      failureReason: body.failureReason,
    })

    let completion:
      | Awaited<ReturnType<typeof completeReplayFromEdge>>
      | undefined

    if (
      (body.status === "verifying" && body.checksumSha256) ||
      body.status === "ready"
    ) {
      completion = await completeReplayFromEdge({
        tenantId: auth.device.tenantId,
        deviceId: auth.device.id,
        mediaId: replayRequest.mediaAssetId,
        replayRequestId: replayRequest.id,
        checksumSha256: body.checksumSha256 ?? null,
        sizeBytes: body.sizeBytes ?? null,
        correlationId: auth.context.correlationId,
      })
    }

    return Response.json({
      data: {
        replayRequest: {
          id: completion?.replayRequestId ?? replayRequest.id,
          status: completion?.status ?? replayRequest.status,
          failureReason: replayRequest.failureReason,
          updatedAt: replayRequest.updatedAt.toISOString(),
        },
        ...(completion
          ? {
              replay: {
                id: completion.replayId,
                status: completion.status,
              },
              media: {
                id: completion.mediaId,
                status: completion.status,
              },
              idempotent: completion.idempotent,
            }
          : {}),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === "ReplayServiceError") {
      return mapReplayServiceError(error)
    }

    return mapDeviceError(error)
  }
}
