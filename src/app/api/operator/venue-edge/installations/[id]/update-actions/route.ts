import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  mapOperatorDeviceError,
  resolveOperatorDeviceWriteContext,
} from "@/server/devices/operator-context"
import { operatorJson } from "@/server/operator/http"
import {
  changeVenueEdgeUpdateChannel,
  pinVenueEdgeInstallationVersion,
  publishVenueEdgeReleaseForOperator,
  requestVenueEdgeUpdateRetry,
  requestVenueEdgeUpdateRollback,
  revokeVenueEdgeReleaseForOperator,
} from "@/server/replays/venue-edge-update-actions"

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("change_channel"),
    channel: z.enum(["pilot", "stable", "emergency", "development"]),
    reason: z.string().trim().min(4).max(256),
  }),
  z.object({
    action: z.literal("pin_version"),
    version: z.string().trim().min(1).max(64).nullable(),
    reason: z.string().trim().min(4).max(256),
  }),
  z.object({
    action: z.literal("retry_update"),
    reason: z.string().trim().min(4).max(256),
  }),
  z.object({
    action: z.literal("rollback_update"),
    reason: z.string().trim().min(4).max(256),
  }),
  z.object({
    action: z.literal("publish_release"),
    releaseId: z.string().uuid(),
    reason: z.string().trim().min(4).max(256),
  }),
  z.object({
    action: z.literal("revoke_release"),
    releaseId: z.string().uuid(),
    reason: z.string().trim().min(4).max(256),
  }),
])

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await resolveOperatorDeviceWriteContext(req)
    if ("error" in resolved) {
      return resolved.error
    }

    const { id } = await context.params
    const body = actionSchema.parse(await req.json())

    if (body.action === "change_channel") {
      const result = await changeVenueEdgeUpdateChannel(
        resolved.context,
        id,
        body.channel,
        body.reason,
      )
      return operatorJson({ result })
    }

    if (body.action === "pin_version") {
      const result = await pinVenueEdgeInstallationVersion(
        resolved.context,
        id,
        body.version,
        body.reason,
      )
      return operatorJson({ result })
    }

    if (body.action === "retry_update") {
      const result = await requestVenueEdgeUpdateRetry(
        resolved.context,
        id,
        body.reason,
      )
      return operatorJson({ result })
    }

    if (body.action === "rollback_update") {
      const result = await requestVenueEdgeUpdateRollback(
        resolved.context,
        id,
        body.reason,
      )
      return operatorJson({ result })
    }

    if (body.action === "publish_release") {
      const release = await publishVenueEdgeReleaseForOperator(
        resolved.context,
        body.releaseId,
        body.reason,
      )
      return operatorJson({ release })
    }

    const release = await revokeVenueEdgeReleaseForOperator(
      resolved.context,
      body.releaseId,
      body.reason,
    )
    return operatorJson({ release })
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}
