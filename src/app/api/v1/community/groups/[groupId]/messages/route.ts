import { type NextRequest } from "next/server"

import { listGroupMessages, sendGroupMessage } from "@/server/community/group-service"
import {
  communityJson,
  communityMessageSchema,
  communityMessagesQuerySchema,
  parseJsonBody,
  parseSearchParams,
  withCommunityUser,
} from "@/server/community/http"

type RouteContext = {
  params: Promise<{ groupId: string }>
}

export async function GET(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { groupId } = await routeContext.params
    const query = parseSearchParams(req, communityMessagesQuerySchema)
    if (!query.ok) return query.response
    return communityJson(await listGroupMessages(tenant, userId, groupId, query.data))
  })
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { groupId } = await routeContext.params
    const body = await parseJsonBody(req, communityMessageSchema)
    if (!body.ok) return body.response
    const result = await sendGroupMessage(tenant, userId, groupId, body.data)
    return communityJson({ message: result.message }, result.duplicate ? 200 : 201)
  })
}
