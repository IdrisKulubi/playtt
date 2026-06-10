import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  bookingError,
  bookingJson,
  mapBookingServiceError,
} from "@/server/bookings/http"
import { getModificationStatus } from "@/server/bookings/modifications/apply"

type RouteContext = {
  params: Promise<{ id: string; modId: string }>
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
    const { id, modId } = await context.params
    const result = await getModificationStatus({
      bookingId: id,
      modificationId: modId,
      userId: session.user.id,
    })

    return bookingJson(result)
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
