import { type NextRequest } from "next/server"

import { communityJson, communityKudosSchema, parseJsonBody, withCommunityUser } from "@/server/community/http"
import { giveKudos } from "@/server/community/social-service"

type RouteContext = {
  params: Promise<{ bookingId: string }>
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { bookingId } = await routeContext.params
    const body = await parseJsonBody(req, communityKudosSchema)
    if (!body.ok) return body.response
    return communityJson(await giveKudos(tenant, userId, bookingId, body.data))
  })
}
