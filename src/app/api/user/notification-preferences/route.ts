import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod/v3"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  notificationNoStoreHeaders,
  NOTIFICATION_PREFERENCE_KEYS,
} from "@/server/notifications/contract"
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/server/notifications/service"
import { bookingError, mapBookingServiceError } from "@/server/bookings/http"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

const patchSchema = z
  .object(
    Object.fromEntries(
      NOTIFICATION_PREFERENCE_KEYS.map((key) => [key, z.boolean().optional()]),
    ) as Record<(typeof NOTIFICATION_PREFERENCE_KEYS)[number], z.ZodOptional<z.ZodBoolean>>,
  )
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Choose a preference to update.")

async function resolveRequest(req: NextRequest) {
  const session = await getSessionWithBearerFallback(req)
  if (!session) return null
  const context = await resolveTenantContextForSessionUser(
    session.user.id,
    req.headers.get("x-tenant-id"),
  )
  return { context, userId: session.user.id }
}

function unauthenticated() {
  const response = bookingError({
    code: "UNAUTHENTICATED",
    message: "Sign in is required.",
    status: 401,
  })
  for (const [key, value] of Object.entries(notificationNoStoreHeaders)) {
    response.headers.set(key, value)
  }
  return response
}

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveRequest(req)
    if (!actor) return unauthenticated()
    const preferences = await getNotificationPreferences(actor.context, {
      userId: actor.userId,
    })
    return NextResponse.json(
      { data: { preferences } },
      { headers: notificationNoStoreHeaders },
    )
  } catch (error) {
    return mapBookingServiceError(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await resolveRequest(req)
    if (!actor) return unauthenticated()
    const preferences = await updateNotificationPreferences(actor.context, {
      userId: actor.userId,
      preferences: patchSchema.parse(await req.json()),
    })
    return NextResponse.json(
      { data: { preferences } },
      { headers: notificationNoStoreHeaders },
    )
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
