import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  revokeVenueEdgeInstallation,
  rotateVenueEdgeInstallationCredential,
  rollbackVenueEdgeInstallationConfig,
  syncVenueEdgeCommissioning,
} from "@/server/replays/venue-edge-operator-actions"
import {
  mapOperatorDeviceError,
  resolveOperatorDeviceWriteContext,
} from "@/server/devices/operator-context"
import { operatorJson } from "@/server/operator/http"

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sync_commissioning"),
    reason: z.string().trim().min(4).max(256),
  }),
  z.object({
    action: z.literal("rollback_config"),
    revisionId: z.string().uuid(),
    reason: z.string().trim().min(4).max(256),
  }),
  z.object({
    action: z.literal("revoke"),
    reason: z.string().trim().min(4).max(256),
  }),
  z.object({
    action: z.literal("rotate_credential"),
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

    if (body.action === "sync_commissioning") {
      const result = await syncVenueEdgeCommissioning(
        resolved.context,
        id,
        body.reason,
      )
      return operatorJson({ result })
    }

    if (body.action === "rollback_config") {
      const revision = await rollbackVenueEdgeInstallationConfig(
        resolved.context,
        id,
        body.revisionId,
        body.reason,
      )
      return operatorJson({ revision })
    }

    if (body.action === "revoke") {
      const device = await revokeVenueEdgeInstallation(
        resolved.context,
        id,
        body.reason,
      )
      return operatorJson({ device })
    }

    const rotated = await rotateVenueEdgeInstallationCredential(
      resolved.context,
      id,
      body.reason,
    )
    return operatorJson({ rotated })
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}
