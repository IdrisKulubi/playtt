import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import { PaymentServiceError } from "@/server/payments/errors"
import { mapPaymentServiceError, paymentJson } from "@/server/payments/http"
import { initiateBookingPayment } from "@/server/payments/service"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  const session = await getSessionWithBearerFallback(req)

  if (!session) {
    return mapPaymentServiceError(
      new PaymentServiceError("UNAUTHENTICATED", "Sign in is required.", 401),
    )
  }

  let body: unknown = {}

  try {
    body = await req.json()
  } catch {
    body = {}
  }

  try {
    const { id } = await context.params
    const result = await initiateBookingPayment({
      bookingId: id,
      userId: session.user.id,
      body,
    })

    return paymentJson(result)
  } catch (error) {
    return mapPaymentServiceError(error)
  }
}
