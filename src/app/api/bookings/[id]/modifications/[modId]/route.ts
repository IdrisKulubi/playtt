import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  bookingError,
  bookingJson,
  mapBookingServiceError,
} from "@/server/bookings/http"
import { getModificationStatus } from "@/server/bookings/modifications/apply"
import { coordinateModificationStatus } from "@/server/bookings/ownership-coordinator"

type RouteContext = {
  params: Promise<{ id: string; modId: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const outcome = await coordinateModificationStatus({
      getActorId: async () =>
        (await getSessionWithBearerFallback(req))?.user.id ?? null,
      getIdentifiers: async () => {
        const { id, modId } = await context.params
        return { bookingId: id, modificationId: modId }
      },
      getModificationStatus,
    })

    if (!outcome.authenticated) {
      return bookingError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    return bookingJson(outcome.value)
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
