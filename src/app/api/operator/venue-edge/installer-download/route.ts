import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod/v3"

import {
  mapOperatorDeviceError,
  resolveOperatorDeviceWriteContext,
} from "@/server/devices/operator-context"
import { createInstallerDownloadForVenue } from "@/server/replays/venue-edge-installer-metadata"

const querySchema = z.object({
  locationId: z.string().uuid(),
  releaseId: z.string().uuid(),
})

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveOperatorDeviceWriteContext(req)
    if ("error" in resolved) return resolved.error
    const input = querySchema.parse({
      locationId: req.nextUrl.searchParams.get("locationId"),
      releaseId: req.nextUrl.searchParams.get("releaseId"),
    })
    const grant = await createInstallerDownloadForVenue({
      context: resolved.context,
      ...input,
      acknowledgeUnsignedPilot:
        req.nextUrl.searchParams.get("acknowledgeUnsignedPilot") === "true",
    })
    return NextResponse.redirect(grant.url, { status: 307 })
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}
