import { type NextRequest } from "next/server"

import { getUnreadCounts } from "@/server/community/chat-service"
import { communityJson, withCommunityUser } from "@/server/community/http"

export async function GET(req: NextRequest) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    return communityJson({ unread: await getUnreadCounts(tenant, userId) })
  })
}
