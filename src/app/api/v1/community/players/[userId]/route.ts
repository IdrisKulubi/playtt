import { type NextRequest } from "next/server"

import { communityJson, withCommunityUser } from "@/server/community/http"
import { getCommunityPlayer } from "@/server/community/service"

type RouteContext = {
  params: Promise<{ userId: string }>
}

export async function GET(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { userId: targetId } = await routeContext.params
    return communityJson(await getCommunityPlayer(tenant, userId, targetId))
  })
}
