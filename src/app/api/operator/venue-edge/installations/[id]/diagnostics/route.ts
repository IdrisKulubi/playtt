import { type NextRequest } from "next/server"

import {
  mapOperatorDeviceError,
  resolveOperatorDeviceWriteContext,
} from "@/server/devices/operator-context"
import { operatorJson } from "@/server/operator/http"
import { buildVenueEdgeInstallationDiagnostics } from "@/server/replays/venue-edge-diagnostics"

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
    const diagnostics = await buildVenueEdgeInstallationDiagnostics(
      resolved.context,
      id,
    )

    return operatorJson({ diagnostics })
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}
