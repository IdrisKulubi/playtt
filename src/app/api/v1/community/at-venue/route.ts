import { type NextRequest } from "next/server"

import { communityJson, withCommunityUser } from "@/server/community/http"
import { listAtVenue } from "@/server/community/social-service"

export async function GET(req: NextRequest) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    return communityJson(await listAtVenue(tenant, userId))
  })
}
