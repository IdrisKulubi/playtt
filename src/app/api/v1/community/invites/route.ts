import { type NextRequest } from "next/server"

import { communityJson, withCommunityUser } from "@/server/community/http"
import { createInvite } from "@/server/community/invite-service"

export async function POST(req: NextRequest) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    return communityJson(await createInvite(tenant, userId), 201)
  })
}
