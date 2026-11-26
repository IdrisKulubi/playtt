import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  getVenueEdgeCameraAssignments,
  saveVenueEdgeCameraAssignments,
} from "@/server/replays/venue-edge-camera-assignments"
import {
  mapOperatorDeviceError,
  resolveOperatorDeviceReadContext,
  resolveOperatorDeviceWriteContext,
} from "@/server/devices/operator-context"
import { operatorJson } from "@/server/operator/http"

const assignmentSchema = z.object({
  assignments: z
    .array(
      z.object({
        tableId: z.string().uuid(),
        primaryCameraId: z.string().uuid().nullable(),
        backupCameraId: z.string().uuid().nullable(),
      }),
    )
    .min(1)
    .max(64),
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
    const view = await getVenueEdgeCameraAssignments(resolved.context, id)
    return operatorJson({ view })
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await resolveOperatorDeviceWriteContext(req)
    if ("error" in resolved) {
      return resolved.error
    }
    const { id } = await context.params
    const body = assignmentSchema.parse(await req.json())
    const revision = await saveVenueEdgeCameraAssignments(
      resolved.context,
      id,
      body.assignments,
      body.reason,
    )
    const view = await getVenueEdgeCameraAssignments(resolved.context, id)
    return operatorJson({ revision: { version: revision.version }, view })
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}
