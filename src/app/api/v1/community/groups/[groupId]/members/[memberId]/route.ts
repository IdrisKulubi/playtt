import { type NextRequest } from "next/server"

import { removeGroupMember } from "@/server/community/group-service"
import { communityJson, withCommunityUser } from "@/server/community/http"

type RouteContext = {
  params: Promise<{ groupId: string; memberId: string }>
}

export async function DELETE(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { groupId, memberId } = await routeContext.params
    return communityJson(await removeGroupMember(tenant, userId, groupId, memberId))
  })
}
