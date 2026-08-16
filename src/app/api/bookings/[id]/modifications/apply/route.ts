import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  bookingError,
  bookingJson,
  mapBookingServiceError,
} from "@/server/bookings/http"
import { applyBookingModification } from "@/server/bookings/modifications/apply"
import { modificationApplyBodySchema } from "@/server/bookings/modifications/validators"
import { coordinateModificationApply } from "@/server/bookings/ownership-coordinator"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const outcome = await coordinateModificationApply({
      getActorId: async () =>
        (await getSessionWithBearerFallback(req))?.user.id ?? null,
      getIdentifiers: async () => {
        const { id } = await context.params
        return { bookingId: id }
      },
      readBody: async () => modificationApplyBodySchema.parse(await req.json()),
      applyModification: applyBookingModification,
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
