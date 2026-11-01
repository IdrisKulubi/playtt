import { type NextRequest } from "next/server"

import { listConversations, startDirectConversation } from "@/server/community/chat-service"
import {
  communityConversationsQuerySchema,
  communityJson,
  communityStartConversationSchema,
  parseJsonBody,
  parseSearchParams,
  withCommunityUser,
} from "@/server/community/http"

export async function GET(req: NextRequest) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const query = parseSearchParams(req, communityConversationsQuerySchema)
    if (!query.ok) return query.response
    return communityJson(await listConversations(tenant, userId, query.data))
  })
}

export async function POST(req: NextRequest) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const body = await parseJsonBody(req, communityStartConversationSchema)
    if (!body.ok) return body.response
    return communityJson(await startDirectConversation(tenant, userId, body.data))
  })
}
