import { type NextRequest } from "next/server"

import { communityJson, withCommunityUser } from "@/server/community/http"
import { followPlayer, unfollowPlayer } from "@/server/community/service"

type RouteContext = {
  params: Promise<{ userId: string }>
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { userId: targetId } = await routeContext.params
    return communityJson(await followPlayer(tenant, userId, targetId))
  })
}

export async function DELETE(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { userId: targetId } = await routeContext.params
    return communityJson(await unfollowPlayer(tenant, userId, targetId))
  })
}
