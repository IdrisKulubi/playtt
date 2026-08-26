import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod/v3"

import { getSessionWithBearerFallback } from "@/lib/security"
import { bookingError, mapBookingServiceError } from "@/server/bookings/http"
import { notificationNoStoreHeaders } from "@/server/notifications/contract"
import {
  registerPushToken,
  revokePushToken,
} from "@/server/notifications/service"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

const tokenSchema = z.object({
  token: z.string().trim().min(10).max(512),
  platform: z.enum(["ios", "android"]),
  deviceName: z.string().trim().min(1).max(100).optional(),
})

async function resolveRequest(req: NextRequest) {
  const session = await getSessionWithBearerFallback(req)
  if (!session) return null
  const context = await resolveTenantContextForSessionUser(
    session.user.id,
    req.headers.get("x-tenant-id"),
  )
  return { context, userId: session.user.id }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await resolveRequest(req)
    if (!actor) {
      return bookingError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }
    const token = await registerPushToken(actor.context, {
      userId: actor.userId,
      ...tokenSchema.parse(await req.json()),
    })
    return NextResponse.json(
      { data: { token } },
      { status: 201, headers: notificationNoStoreHeaders },
    )
  } catch (error) {
    return mapBookingServiceError(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await resolveRequest(req)
    if (!actor) {
      return bookingError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }
    const input = tokenSchema.pick({ token: true, platform: true }).parse(await req.json())
    await revokePushToken(actor.context, { userId: actor.userId, ...input })
    return new NextResponse(null, {
      status: 204,
      headers: notificationNoStoreHeaders,
    })
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
