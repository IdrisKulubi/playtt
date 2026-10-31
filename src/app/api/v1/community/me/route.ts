import { type NextRequest } from "next/server"

import {
  communityJson,
  communityProfilePatchSchema,
  parseJsonBody,
  withCommunityUser,
} from "@/server/community/http"
import { getMyCommunity, updateMyCommunityProfile } from "@/server/community/service"

export async function GET(req: NextRequest) {
  return withCommunityUser(req, async ({ userId, tenant }) =>
    communityJson({ me: await getMyCommunity(tenant, userId) }),
  )
}

export async function PATCH(req: NextRequest) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const parsed = await parseJsonBody(req, communityProfilePatchSchema)
    if (!parsed.ok) return parsed.response

    return communityJson({ me: await updateMyCommunityProfile(tenant, userId, parsed.data) })
  })
}
