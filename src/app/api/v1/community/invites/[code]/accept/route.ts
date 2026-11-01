import { type NextRequest } from "next/server"

import { communityJson, withCommunityUser } from "@/server/community/http"
import { acceptInvite } from "@/server/community/invite-service"

type RouteContext = {
  params: Promise<{ code: string }>
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { code } = await routeContext.params
    return communityJson(await acceptInvite(tenant, userId, code))
  })
}
