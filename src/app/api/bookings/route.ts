import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  bookingError,
  bookingJson,
  mapBookingServiceError,
} from "@/server/bookings/http"
import { createPendingBooking } from "@/server/bookings/service"
import { createBookingBodySchema } from "@/server/bookings/validators"
import { getUserProfileById } from "@/server/users/onboarding"
import { createCorrelationId } from "@/server/tenancy/correlation"
import { resolveRequestTenantContext } from "@/server/tenancy/resolve-request-context"

export async function POST(req: NextRequest) {
  const session = await getSessionWithBearerFallback(req)

  if (!session) {
    return bookingError({
      code: "UNAUTHENTICATED",
      message: "Sign in is required.",
      status: 401,
    })
  }

  const profile = await getUserProfileById(session.user.id)

  if (!profile?.onboardingCompletedAt) {
    return bookingError({
      code: "ONBOARDING_INCOMPLETE",
      message: "Complete your player profile before booking.",
      status: 400,
    })
  }

  let body: unknown

  try {
    body = await req.json()
  } catch {
    return bookingError({
      code: "INVALID_BODY",
      message: "Invalid request body.",
      status: 400,
    })
  }

  const parsed = createBookingBodySchema.safeParse(body)

  if (!parsed.success) {
    return bookingError({
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Invalid booking request.",
      status: 400,
    })
  }

  try {
    const context = await resolveRequestTenantContext({
      userId: session.user.id,
      correlationId: createCorrelationId(),
      clientTenantId: req.headers.get("x-tenant-id"),
    })
    const result = await createPendingBooking(context, {
      ...parsed.data,
      userId: session.user.id,
    })

    return bookingJson(result, 201)
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
