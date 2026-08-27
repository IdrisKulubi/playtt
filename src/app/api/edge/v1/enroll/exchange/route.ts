import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { DeviceError } from "@/server/devices/errors"
import { mapDeviceError } from "@/server/devices/http"
import { recordFailedPairingLookup } from "@/server/replays/venue-edge-pairing-rate-limit"
import { exchangeVenueEdgeEnrollment } from "@/server/replays/venue-edge-enrollment"
import { createCorrelationId } from "@/server/tenancy/correlation"

const exchangeSchema = z.object({
  pairingCode: z.string().trim().min(1),
  installationUid: z.string().uuid(),
  platform: z.string().trim().min(1).max(120),
  architecture: z.string().trim().min(1).max(120),
  agentVersion: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(160).optional(),
})

function getClientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

export async function POST(req: NextRequest) {
  let lookupSubject = "unknown"

  try {
    const body = exchangeSchema.parse(await req.json())
    const normalizedPrefix = body.pairingCode
      .replace(/-/g, "")
      .trim()
      .toUpperCase()
      .slice(0, 4)
    lookupSubject = `${getClientIp(req)}:${normalizedPrefix}`

    const result = await exchangeVenueEdgeEnrollment({
      pairingCode: body.pairingCode,
      installationUid: body.installationUid,
      platform: body.platform,
      architecture: body.architecture,
      agentVersion: body.agentVersion,
      displayName: body.displayName,
      lookupSubject,
      correlationId:
        req.headers.get("x-correlation-id") ?? createCorrelationId(),
    })

    return Response.json({ data: result }, { status: 201 })
  } catch (error) {
    if (error instanceof DeviceError && error.code === "PAIRING_SESSION_INVALID") {
      await recordFailedPairingLookup({ subject: lookupSubject })
    }

    return mapDeviceError(error)
  }
}
