import { type NextRequest } from "next/server"

import {
  mapOperatorDeviceError,
  resolveOperatorDeviceWriteContext,
} from "@/server/devices/operator-context"
import { operatorJson } from "@/server/operator/http"
import { cancelVenueEdgePairingSession } from "@/server/replays/venue-edge-pairing-sessions"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const resolved = await resolveOperatorDeviceWriteContext(req)
    if ("error" in resolved) {
      return resolved.error
    }

    const { id } = await context.params
    const session = await cancelVenueEdgePairingSession(resolved.context, id)

    return operatorJson({ session })
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  return POST(req, context)
}
