import { type NextRequest } from "next/server"

import { listVenueEdgeInstallations } from "@/server/replays/venue-edge-fleet"
import { DeviceError } from "@/server/devices/errors"
import {
  mapOperatorDeviceError,
  resolveOperatorDeviceReadContext,
} from "@/server/devices/operator-context"
import { operatorJson } from "@/server/operator/http"

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveOperatorDeviceReadContext(req)
    if ("error" in resolved) {
      return resolved.error
    }

    const locationId = req.nextUrl.searchParams.get("locationId")
    if (!locationId) {
      throw new DeviceError(
        "VALIDATION_ERROR",
        "locationId query parameter is required.",
        400,
      )
    }

    const installations = await listVenueEdgeInstallations(
      resolved.context,
      locationId,
      {
        health: req.nextUrl.searchParams.get("health") ?? undefined,
        commissioning:
          req.nextUrl.searchParams.get("commissioning") ?? undefined,
        version: req.nextUrl.searchParams.get("version") ?? undefined,
      },
    )

    return operatorJson({ installations })
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}
