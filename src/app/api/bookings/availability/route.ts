import { type NextRequest } from "next/server"

import { bookingJson, mapBookingServiceError } from "@/server/bookings/http"
import { getLocationAvailability } from "@/server/bookings/service"
import { resolvePublicCatalogContext } from "@/server/tenancy/session-context"

export async function GET(req: NextRequest) {
  try {
    const context = await resolvePublicCatalogContext()
    const params = req.nextUrl.searchParams
    const slots = await getLocationAvailability(context, {
      locationId: params.get("locationId"),
      date: params.get("date"),
      durationMinutes: Number(params.get("durationMinutes")),
      groupSize: Number(params.get("groupSize")),
    })

    return bookingJson({ slots })
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
