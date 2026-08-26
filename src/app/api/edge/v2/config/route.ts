import { type NextRequest } from "next/server"

import { requireDeviceRequest } from "@/server/devices/auth"
import { DeviceError } from "@/server/devices/errors"
import { deviceJson, mapDeviceError } from "@/server/devices/http"
import { validateEdgeAgentVersion } from "@/server/replays/edge-agent-version"
import {
  getPublishedEdgeConfigV2ForDevice,
  VENUE_EDGE_V2_MINIMUM_AGENT_VERSION,
} from "@/server/replays/edge-config-v2-repository"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireDeviceRequest(req)
    const version = validateEdgeAgentVersion(
      req.headers.get("x-playtt-edge-agent-version"),
      VENUE_EDGE_V2_MINIMUM_AGENT_VERSION
    )
    if (!version.success) {
      throw new DeviceError(version.code, version.message, 426)
    }
    const config = await getPublishedEdgeConfigV2ForDevice({
      tenantId: auth.device.tenantId,
      locationId: auth.device.locationId,
      deviceId: auth.device.id,
      deviceType: auth.device.type,
    })

    // A republished revision must not be hidden by a matching topology
    // checksum; the agent still needs the new revision identity to acknowledge.
    const etag = `"edge-v2-${config.configRevision.version}-${config.configRevision.checksum.slice("sha256:".length)}"`
    if (req.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          "cache-control": "private, no-cache",
          etag,
        },
      })
    }

    const response = deviceJson(config)
    response.headers.set("cache-control", "private, no-cache")
    response.headers.set("etag", etag)
    return response
  } catch (error) {
    return mapDeviceError(error)
  }
}
