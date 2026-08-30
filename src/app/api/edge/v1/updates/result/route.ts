import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { requireDeviceRequest } from "@/server/devices/auth"
import { deviceJson, mapDeviceError } from "@/server/devices/http"
import { recordVenueEdgeUpdateResult } from "@/server/replays/venue-edge-updates"

const resultSchema = z.object({
  attemptId: z.string().uuid(),
  status: z.enum(["started", "succeeded", "failed", "rolled_back"]),
  reasonCode: z.string().trim().max(128).nullable().optional(),
  appliedVersion: z.string().trim().max(64).nullable().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDeviceRequest(req)
    const body = resultSchema.parse(await req.json())

    const result = await recordVenueEdgeUpdateResult({
      tenantId: auth.device.tenantId,
      deviceId: auth.device.id,
      attemptId: body.attemptId,
      status: body.status,
      reasonCode: body.reasonCode ?? null,
      appliedVersion: body.appliedVersion ?? null,
      correlationId: auth.context.correlationId,
    })

    return deviceJson(result)
  } catch (error) {
    return mapDeviceError(error)
  }
}
