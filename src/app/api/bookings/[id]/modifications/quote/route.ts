import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  bookingError,
  bookingJson,
  mapBookingServiceError,
} from "@/server/bookings/http"
import { quoteBookingModification } from "@/server/bookings/modifications/quote"
import { modificationQuoteBodySchema } from "@/server/bookings/modifications/validators"

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
    const body = modificationQuoteBodySchema.parse(await req.json())
    const result = await quoteBookingModification({
      bookingId: id,
      userId: session.user.id,
      body,
    })

    return bookingJson({ modificationPreview: result.quote })
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
