import { type NextRequest } from "next/server"

import { listEvents } from "@/server/community/group-service"
import { communityJson, withCommunityUser } from "@/server/community/http"

export async function GET(req: NextRequest) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    return communityJson(await listEvents(tenant, userId))
  })
}
