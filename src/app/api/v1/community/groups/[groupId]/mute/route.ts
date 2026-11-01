import { type NextRequest } from "next/server"

import { muteGroup } from "@/server/community/group-service"
import { communityGroupMuteSchema, communityJson, parseJsonBody, withCommunityUser } from "@/server/community/http"

type RouteContext = {
  params: Promise<{ groupId: string }>
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { groupId } = await routeContext.params
    const body = await parseJsonBody(req, communityGroupMuteSchema)
    if (!body.ok) return body.response
    return communityJson(await muteGroup(tenant, userId, groupId, body.data.hours))
  })
}
