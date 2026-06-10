import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import { bookingError, bookingJson } from "@/server/bookings/http"
import { PaymentServiceError } from "@/server/payments/errors"
import { cancelUnpaidBooking } from "@/server/payments/repository"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
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
    const result = await cancelUnpaidBooking({
      bookingId: id,
      userId: session.user.id,
    })

    if (!result) {
      return bookingError({
        code: "BOOKING_NOT_FOUND",
        message: "We could not find that booking.",
        status: 404,
      })
    }

    if (result.status !== "cancelled") {
      throw new PaymentServiceError(
        "BOOKING_NOT_CANCELLABLE",
        "Only unpaid pending bookings can be cancelled.",
        409,
      )
    }

    return bookingJson({ booking: result })
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      return bookingError({
        code: error.code,
        message: error.message,
        status: error.status,
      })
    }

    return bookingError({
      code: "BOOKING_ERROR",
      message: "Could not cancel this booking.",
      status: 500,
    })
  }
}
