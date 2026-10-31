import { type NextRequest } from "next/server"

import {
  communityAvailabilitySchema,
  communityJson,
  parseJsonBody,
  withCommunityUser,
} from "@/server/community/http"
import { goOpenToPlay, stopOpenToPlay } from "@/server/community/service"

export async function POST(req: NextRequest) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const parsed = await parseJsonBody(req, communityAvailabilitySchema)
    if (!parsed.ok) return parsed.response

    return communityJson({ me: await goOpenToPlay(tenant, userId, parsed.data) }, 201)
  })
}

export async function DELETE(req: NextRequest) {
  return withCommunityUser(req, async ({ userId, tenant }) =>
    communityJson({ me: await stopOpenToPlay(tenant, userId) }),
  )
}
