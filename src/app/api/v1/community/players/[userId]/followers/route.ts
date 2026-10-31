import { type NextRequest } from "next/server"

import {
  communityCursorQuerySchema,
  communityJson,
  parseSearchParams,
  withCommunityUser,
} from "@/server/community/http"
import { listConnections } from "@/server/community/service"

type RouteContext = {
  params: Promise<{ userId: string }>
}

export async function GET(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const parsed = parseSearchParams(req, communityCursorQuerySchema)
    if (!parsed.ok) return parsed.response

    const { userId: targetId } = await routeContext.params
    return communityJson(
      await listConnections(tenant, userId, targetId, "followers", parsed.data.cursor),
    )
  })
}
