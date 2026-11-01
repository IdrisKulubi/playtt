import { type NextRequest } from "next/server"

import { joinEvent } from "@/server/community/group-service"
import { communityJson, withCommunityUser } from "@/server/community/http"

type RouteContext = {
  params: Promise<{ eventId: string }>
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { eventId } = await routeContext.params
    return communityJson(await joinEvent(tenant, userId, eventId))
  })
}
