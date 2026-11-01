import { type NextRequest } from "next/server"

import { leaveGroup } from "@/server/community/group-service"
import { communityJson, withCommunityUser } from "@/server/community/http"

type RouteContext = {
  params: Promise<{ groupId: string }>
}

export async function DELETE(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { groupId } = await routeContext.params
    return communityJson(await leaveGroup(tenant, userId, groupId))
  })
}
