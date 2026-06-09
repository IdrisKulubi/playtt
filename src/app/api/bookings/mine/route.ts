import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  bookingError,
  bookingJson,
  mapBookingServiceError,
} from "@/server/bookings/http"
import type { BookingListFilter } from "@/server/bookings/repository"
import { listBookingsForUser } from "@/server/bookings/service"

function parseFilter(value: string | null): BookingListFilter {
  if (value === "upcoming" || value === "past") {
    return value
  }

  return "all"
}

export async function GET(req: NextRequest) {
  const session = await getSessionWithBearerFallback(req)

  if (!session) {
    return bookingError({
      code: "UNAUTHENTICATED",
      message: "Sign in is required.",
      status: 401,
    })
  }

  try {
    const filter = parseFilter(req.nextUrl.searchParams.get("filter"))
    const bookings = await listBookingsForUser({
      userId: session.user.id,
      filter,
    })

    return bookingJson({ bookings })
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
