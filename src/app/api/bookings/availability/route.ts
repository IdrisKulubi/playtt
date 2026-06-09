import { type NextRequest } from "next/server"

import { bookingJson, mapBookingServiceError } from "@/server/bookings/http"
import { getLocationAvailability } from "@/server/bookings/service"

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const slots = await getLocationAvailability({
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
