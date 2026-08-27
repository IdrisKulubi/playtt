import { type NextRequest } from "next/server"

import { requireDeviceRequest } from "@/server/devices/auth"
import { mapDeviceError } from "@/server/devices/http"
import { confirmVenueEdgeEnrollment } from "@/server/replays/venue-edge-enrollment"

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDeviceRequest(req)
    const result = await confirmVenueEdgeEnrollment(auth)

    return Response.json({ data: result })
  } catch (error) {
    return mapDeviceError(error)
  }
}
