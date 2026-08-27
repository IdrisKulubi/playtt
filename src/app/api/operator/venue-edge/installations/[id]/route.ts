import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { getVenueEdgeInstallationDetail } from "@/server/replays/venue-edge-fleet"
import { renameVenueEdgeInstallation } from "@/server/replays/venue-edge-operator-actions"
import { DeviceError } from "@/server/devices/errors"
import {
  mapOperatorDeviceError,
  resolveOperatorDeviceReadContext,
  resolveOperatorDeviceWriteContext,
} from "@/server/devices/operator-context"
import { operatorJson } from "@/server/operator/http"

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(4).max(256),
})

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await resolveOperatorDeviceReadContext(req)
    if ("error" in resolved) {
      return resolved.error
    }

    const { id } = await context.params
    const installation = await getVenueEdgeInstallationDetail(
      resolved.context,
      id,
    )

    return operatorJson({ installation })
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await resolveOperatorDeviceWriteContext(req)
    if ("error" in resolved) {
      return resolved.error
    }

    const { id } = await context.params
    const body = patchSchema.parse(await req.json())
    const installation = await renameVenueEdgeInstallation(
      resolved.context,
      id,
      body.displayName,
      body.reason,
    )

    return operatorJson({ installation })
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}
