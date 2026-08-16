import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  bookingError,
  bookingJson,
  mapBookingServiceError,
} from "@/server/bookings/http"
import { quoteBookingModification } from "@/server/bookings/modifications/quote"
import { modificationQuoteBodySchema } from "@/server/bookings/modifications/validators"
import { coordinateModificationQuote } from "@/server/bookings/ownership-coordinator"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const outcome = await coordinateModificationQuote({
      getActorId: async () =>
        (await getSessionWithBearerFallback(req))?.user.id ?? null,
      getIdentifiers: async () => {
        const { id } = await context.params
        return { bookingId: id }
      },
      readBody: async () => modificationQuoteBodySchema.parse(await req.json()),
      quoteModification: quoteBookingModification,
    })

    if (!outcome.authenticated) {
      return bookingError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    return bookingJson({ modificationPreview: outcome.value.quote })
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
