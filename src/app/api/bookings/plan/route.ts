import { type NextRequest } from "next/server"

import { bookingJson, mapBookingServiceError } from "@/server/bookings/http"
import { planBookingTime } from "@/server/bookings/service"
import { resolvePublicCatalogContext } from "@/server/tenancy/session-context"

/**
 * GET /api/bookings/plan?locationId&startTimeIso&durationMinutes&groupSize
 * Checks a custom start time across the venue's tables. Returns the free table
 * and price, or the busy times and up to three nearby times that work.
 */
export async function GET(req: NextRequest) {
  try {
    const context = await resolvePublicCatalogContext()
    const params = req.nextUrl.searchParams
    const plan = await planBookingTime(context, {
      locationId: params.get("locationId"),
      startTimeIso: params.get("startTimeIso"),
      durationMinutes: Number(params.get("durationMinutes")),
      groupSize: Number(params.get("groupSize")),
    })

    return bookingJson({ plan })
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
