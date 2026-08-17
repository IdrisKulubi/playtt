import { type NextRequest } from "next/server"

import { bookingJson, mapBookingServiceError } from "@/server/bookings/http"
import { getBookingQuote } from "@/server/bookings/service"
import { resolvePublicCatalogContext } from "@/server/tenancy/session-context"

export async function GET(req: NextRequest) {
  try {
    const context = await resolvePublicCatalogContext()
    const params = req.nextUrl.searchParams
    const quote = await getBookingQuote(context, {
      locationId: params.get("locationId"),
      resourceId: params.get("resourceId"),
      startTimeIso: params.get("startTimeIso"),
      durationMinutes: Number(params.get("durationMinutes")),
      groupSize: Number(params.get("groupSize")),
    })

    return bookingJson({ quote })
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
