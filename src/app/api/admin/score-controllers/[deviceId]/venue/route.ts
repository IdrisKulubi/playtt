import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { resolveAdminApiContext } from "@/server/admin/api-context"
import { moveScoreControllerToVenue } from "@/server/devices/score-controllers"
import { mapOperatorError, operatorJson } from "@/server/operator/http"

type RouteContext = { params: Promise<{ deviceId: string }> }

const moveSchema = z.object({ venueId: z.string().uuid() })

/** Sends a score controller to another venue, where it arrives as a spare. */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved
    const { deviceId } = await params
    const body = moveSchema.parse(await req.json())
    return operatorJson(
      await moveScoreControllerToVenue(resolved.context, { deviceId, toVenueId: body.venueId }),
    )
  } catch (error) {
    return mapOperatorError(error)
  }
}
