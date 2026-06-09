import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  bookingError,
  bookingJson,
  mapBookingServiceError,
} from "@/server/bookings/http"
import { getBookingForUser } from "@/server/bookings/service"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const session = await getSessionWithBearerFallback(req)

  if (!session) {
    return bookingError({
      code: "UNAUTHENTICATED",
      message: "Sign in is required.",
      status: 401,
    })
  }

  try {
    const { id } = await context.params
    const booking = await getBookingForUser({
      userId: session.user.id,
      bookingId: id,
    })

    if (!booking) {
      return bookingError({
        code: "BOOKING_NOT_FOUND",
        message: "We could not find that booking.",
        status: 404,
      })
    }

    return bookingJson({ booking })
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
