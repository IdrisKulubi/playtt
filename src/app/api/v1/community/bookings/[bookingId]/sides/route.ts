import { type NextRequest } from "next/server"

import { communityJson, communityMatchSidesSchema, parseJsonBody, withCommunityUser } from "@/server/community/http"
import { assignMatchSides } from "@/server/community/match-service"

type RouteContext = {
  params: Promise<{ bookingId: string }>
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { bookingId } = await routeContext.params
    const body = await parseJsonBody(req, communityMatchSidesSchema)
    if (!body.ok) return body.response
    return communityJson({ match: await assignMatchSides(tenant, userId, bookingId, body.data) })
  })
}
