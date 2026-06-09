import { type NextRequest } from "next/server"

import { bookingJson, mapBookingServiceError } from "@/server/bookings/http"
import { getBookingQuote } from "@/server/bookings/service"

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const quote = await getBookingQuote({
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
