import { type NextRequest } from "next/server"

import { markGroupRead } from "@/server/community/group-service"
import { communityJson, communityReadSchema, parseJsonBody, withCommunityUser } from "@/server/community/http"

type RouteContext = {
  params: Promise<{ groupId: string }>
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { groupId } = await routeContext.params
    const body = await parseJsonBody(req, communityReadSchema)
    if (!body.ok) return body.response
    return communityJson(await markGroupRead(tenant, userId, groupId, body.data.seq))
  })
}
