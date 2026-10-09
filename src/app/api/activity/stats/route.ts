import { type NextRequest } from "next/server"
import { getSessionWithBearerFallback } from "@/lib/security"
import {
  bookingError,
  bookingJson,
  mapBookingServiceError,
} from "@/server/bookings/http"
import {
  activityRange,
  nairobiDate,
  type ActivityPeriod,
} from "@/server/activity/aggregate"
import { getPlayerActivity } from "@/server/activity/service"
import { TenancyError } from "@/server/tenancy/errors"
import { createCorrelationId } from "@/server/tenancy/correlation"
import { resolveRequestTenantContext } from "@/server/tenancy/resolve-request-context"

export async function GET(req: NextRequest) {
  const session = await getSessionWithBearerFallback(req)
  if (!session)
    return bookingError({
      code: "UNAUTHENTICATED",
      message: "Sign in is required.",
      status: 401,
    })
  const period = req.nextUrl.searchParams.get("period") ?? "year"
  const date = req.nextUrl.searchParams.get("date") ?? nairobiDate(new Date())
  if (!["year", "month", "day"].includes(period))
    return bookingError({
      code: "VALIDATION_ERROR",
      message: "Choose year, month or day.",
      status: 400,
    })
  try {
    activityRange(period as ActivityPeriod, date)
  } catch {
    return bookingError({
      code: "VALIDATION_ERROR",
      message: "Choose a valid date between 2000 and 2100.",
      status: 400,
    })
  }
  try {
    const context = await resolveRequestTenantContext({
      userId: session.user.id,
      correlationId: createCorrelationId(),
      clientTenantId: req.headers.get("x-tenant-id"),
    })
    const result = await getPlayerActivity(
      context,
      session.user.id,
      period as ActivityPeriod,
      date
    )
    const response = bookingJson(result)
    response.headers.set("Cache-Control", "private, no-store")
    return response
  } catch (error) {
    if (error instanceof TenancyError) return mapBookingServiceError(error)
    console.error("Player activity query failed", error)
    return bookingError({
      code: "INTERNAL_ERROR",
      message: "Could not load your activity. Please try again.",
      status: 500,
    })
  }
}
