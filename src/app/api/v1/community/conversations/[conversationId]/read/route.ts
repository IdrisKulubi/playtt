import { type NextRequest } from "next/server"

import { markConversationRead } from "@/server/community/chat-service"
import { communityJson, communityReadSchema, parseJsonBody, withCommunityUser } from "@/server/community/http"

type RouteContext = {
  params: Promise<{ conversationId: string }>
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { conversationId } = await routeContext.params
    const body = await parseJsonBody(req, communityReadSchema)
    if (!body.ok) return body.response
    return communityJson(await markConversationRead(tenant, userId, conversationId, body.data.seq))
  })
}
