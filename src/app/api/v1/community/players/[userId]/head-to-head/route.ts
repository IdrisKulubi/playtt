import { type NextRequest } from "next/server"

import { communityJson, withCommunityUser } from "@/server/community/http"
import { getHeadToHead } from "@/server/community/match-service"

type RouteContext = {
  params: Promise<{ userId: string }>
}

export async function GET(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { userId: targetId } = await routeContext.params
    return communityJson(await getHeadToHead(tenant, userId, targetId))
  })
}
