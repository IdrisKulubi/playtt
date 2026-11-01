import { type NextRequest } from "next/server"

import { listMessages, sendMessage } from "@/server/community/chat-service"
import {
  communityJson,
  communityMessageSchema,
  communityMessagesQuerySchema,
  parseJsonBody,
  parseSearchParams,
  withCommunityUser,
} from "@/server/community/http"

type RouteContext = {
  params: Promise<{ conversationId: string }>
}

export async function GET(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { conversationId } = await routeContext.params
    const query = parseSearchParams(req, communityMessagesQuerySchema)
    if (!query.ok) return query.response
    return communityJson(await listMessages(tenant, userId, conversationId, query.data))
  })
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { conversationId } = await routeContext.params
    const body = await parseJsonBody(req, communityMessageSchema)
    if (!body.ok) return body.response
    const result = await sendMessage(tenant, userId, conversationId, body.data)
    return communityJson({ message: result.message }, result.duplicate ? 200 : 201)
  })
}
