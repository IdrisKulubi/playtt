import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import { coordinateBookingPaymentStatus } from "@/server/bookings/ownership-coordinator"
import { PaymentServiceError } from "@/server/payments/errors"
import { mapPaymentServiceError, paymentJson } from "@/server/payments/http"
import { getBookingPaymentStatus } from "@/server/payments/service"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const outcome = await coordinateBookingPaymentStatus({
      getActorId: async () =>
        (await getSessionWithBearerFallback(req))?.user.id ?? null,
      getIdentifiers: async () => {
        const { id } = await context.params
        return { bookingId: id }
      },
      getPaymentStatus: getBookingPaymentStatus,
    })

    if (!outcome.authenticated) {
      return mapPaymentServiceError(
        new PaymentServiceError("UNAUTHENTICATED", "Sign in is required.", 401)
      )
    }

    return paymentJson(outcome.value)
  } catch (error) {
    return mapPaymentServiceError(error)
  }
}
