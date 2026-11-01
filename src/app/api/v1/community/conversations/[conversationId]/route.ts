import { type NextRequest } from "next/server"

import { leaveConversation } from "@/server/community/chat-service"
import { communityJson, withCommunityUser } from "@/server/community/http"

type RouteContext = {
  params: Promise<{ conversationId: string }>
}

export async function DELETE(req: NextRequest, routeContext: RouteContext) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const { conversationId } = await routeContext.params
    return communityJson(await leaveConversation(tenant, userId, conversationId))
  })
}
