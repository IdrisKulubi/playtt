import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  createVenueEdgePairingSession,
  listVenueEdgePairingSessions,
} from "@/server/replays/venue-edge-pairing-sessions"
import { DeviceError } from "@/server/devices/errors"
import {
  mapOperatorDeviceError,
  resolveOperatorDeviceReadContext,
  resolveOperatorDeviceWriteContext,
} from "@/server/devices/operator-context"
import { operatorJson } from "@/server/operator/http"

const createSchema = z.object({
  locationId: z.string().uuid(),
  replaceInstallationId: z.string().uuid().optional(),
  expiresInMinutes: z.number().int().positive().max(60).optional(),
})

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

    const sessions = await listVenueEdgePairingSessions(
      resolved.context,
      locationId,
    )

    return operatorJson({ sessions })
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveOperatorDeviceWriteContext(req)
    if ("error" in resolved) {
      return resolved.error
    }

    const body = createSchema.parse(await req.json())
    const session = await createVenueEdgePairingSession(resolved.context, body)

    return operatorJson({ session }, 201)
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}
