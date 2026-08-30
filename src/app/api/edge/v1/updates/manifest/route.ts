import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { requireDeviceRequest } from "@/server/devices/auth"
import { deviceJson, mapDeviceError } from "@/server/devices/http"
import {
  getVenueEdgeUpdateManifestForDevice,
} from "@/server/replays/venue-edge-updates"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireDeviceRequest(req)
    const result = await getVenueEdgeUpdateManifestForDevice({
      tenantId: auth.device.tenantId,
      deviceId: auth.device.id,
      correlationId: auth.context.correlationId,
    })

    return deviceJson(result)
  } catch (error) {
    return mapDeviceError(error)
  }
}
