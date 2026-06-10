import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  bookingError,
  bookingJson,
  mapBookingServiceError,
} from "@/server/bookings/http"
import { applyBookingModification } from "@/server/bookings/modifications/apply"
import { modificationApplyBodySchema } from "@/server/bookings/modifications/validators"

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
    const body = modificationApplyBodySchema.parse(await req.json())
    const result = await applyBookingModification({
      bookingId: id,
      userId: session.user.id,
      body,
    })

    return bookingJson(result)
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
