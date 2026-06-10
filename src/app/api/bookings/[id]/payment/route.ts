import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import { PaymentServiceError } from "@/server/payments/errors"
import { mapPaymentServiceError, paymentJson } from "@/server/payments/http"
import { getBookingPaymentStatus } from "@/server/payments/service"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const session = await getSessionWithBearerFallback(req)

  if (!session) {
    return mapPaymentServiceError(
      new PaymentServiceError("UNAUTHENTICATED", "Sign in is required.", 401),
    )
  }

  try {
    const { id } = await context.params
    const result = await getBookingPaymentStatus({
      bookingId: id,
      userId: session.user.id,
    })

    return paymentJson(result)
  } catch (error) {
    return mapPaymentServiceError(error)
  }
}
