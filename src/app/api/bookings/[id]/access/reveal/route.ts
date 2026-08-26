import { type NextRequest, NextResponse } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import { bookingAccessNoStoreHeaders } from "@/server/access/player-contract"
import { revealBookingAccessCode } from "@/server/access/service"
import { AccessDomainError } from "@/server/access/domain-error"
import {
  ACCESS_FEATURE_KEYS,
  isAccessFeatureEnabled,
} from "@/server/access/feature-policy"
import { bookingError, mapBookingServiceError } from "@/server/bookings/http"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, routeContext: RouteContext) {
  try {
    const session = await getSessionWithBearerFallback(req)
    if (!session) {
      const response = bookingError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
      for (const [name, value] of Object.entries(bookingAccessNoStoreHeaders())) {
        response.headers.set(name, value)
      }
      return response
    }

    const { id: bookingId } = await routeContext.params
    const context = await resolveTenantContextForSessionUser(
      session.user.id,
      req.headers.get("x-tenant-id"),
    )
    if (!(await isAccessFeatureEnabled(context, ACCESS_FEATURE_KEYS.liveAccess))) {
      return bookingError({
        code: "FEATURE_DISABLED",
        message: "Live venue access is not enabled.",
        status: 403,
      })
    }
    const result = await revealBookingAccessCode(context, {
      userId: session.user.id,
      bookingId,
    })

    return NextResponse.json(
      {
        data: {
          code: result.code,
          validFrom: result.validFrom,
          validUntil: result.validUntil,
        },
      },
      { headers: bookingAccessNoStoreHeaders() },
    )
  } catch (error) {
    const response =
      error instanceof AccessDomainError
        ? bookingError({ code: error.code, message: error.message, status: error.status })
        : mapBookingServiceError(error)
    for (const [name, value] of Object.entries(bookingAccessNoStoreHeaders())) {
      response.headers.set(name, value)
    }
    return response
  }
}
