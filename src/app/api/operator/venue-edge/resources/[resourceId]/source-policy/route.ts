import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { updateVenueEdgeResourcePolicy } from "@/server/replays/venue-edge-operator-actions"
import {
  mapOperatorDeviceError,
  resolveOperatorDeviceWriteContext,
} from "@/server/devices/operator-context"
import { operatorJson } from "@/server/operator/http"

const policySchema = z.object({
  locationId: z.string().uuid(),
  selectionMode: z.enum(["automatic", "manual"]).optional(),
  manualSourceId: z.string().uuid().nullable().optional(),
  clearOverride: z.boolean().optional(),
  candidates: z
    .array(
      z.object({
        sourceId: z.string().uuid(),
        priority: z.number().int().positive(),
        captureModes: z.array(z.enum(["edge_buffer", "nvr_playback"])).min(1),
        enabled: z.boolean().optional(),
      }),
    )
    .optional(),
  reason: z.string().trim().min(4).max(256),
})

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ resourceId: string }> },
) {
  try {
    const resolved = await resolveOperatorDeviceWriteContext(req)
    if ("error" in resolved) {
      return resolved.error
    }

    const { resourceId } = await context.params
    const body = policySchema.parse(await req.json())

    const revision = await updateVenueEdgeResourcePolicy(
      resolved.context,
      body.locationId,
      resourceId,
      body,
    )

    return operatorJson({ revision })
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}
