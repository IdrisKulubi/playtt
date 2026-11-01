import { type NextRequest } from "next/server"

import {
  communityJoinBookingSchema,
  communityJson,
  parseJsonBody,
  withCommunityUser,
} from "@/server/community/http"
import { joinSharedBooking, leaveSharedBooking } from "@/server/community/social-service"

type RouteContext = {
  params: Promise<{ bookingId: string }>
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { bookingId } = await routeContext.params
    const body = await parseJsonBody(req, communityJoinBookingSchema)
    if (!body.ok) return body.response
    return communityJson(await joinSharedBooking(tenant, userId, bookingId, body.data))
  })
}

export async function DELETE(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { bookingId } = await routeContext.params
    return communityJson(await leaveSharedBooking(tenant, userId, bookingId))
  })
}
