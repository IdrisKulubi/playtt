import { type NextRequest } from "next/server"

import { joinDoubles } from "@/server/community/group-service"
import { communityJson, withCommunityUser } from "@/server/community/http"

type RouteContext = {
  params: Promise<{ userId: string }>
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { userId: hostId } = await routeContext.params
    return communityJson(await joinDoubles(tenant, userId, hostId))
  })
}
