import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  bookingError,
  bookingJson,
  mapBookingServiceError,
} from "@/server/bookings/http"
import { coordinateBookingDetail } from "@/server/bookings/ownership-coordinator"
import { getBookingForUser } from "@/server/bookings/service"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const outcome = await coordinateBookingDetail({
      getActorId: async () =>
        (await getSessionWithBearerFallback(req))?.user.id ?? null,
      getIdentifiers: async () => {
        const { id } = await context.params
        return { bookingId: id }
      },
      getBooking: getBookingForUser,
    })

    if (!outcome.authenticated) {
      return bookingError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    const booking = outcome.value

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
