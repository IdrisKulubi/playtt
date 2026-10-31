import { type NextRequest } from "next/server"

import {
  communityJson,
  communityPlayersQuerySchema,
  parseSearchParams,
  withCommunityUser,
} from "@/server/community/http"
import { listCommunityPlayers } from "@/server/community/service"

export async function GET(req: NextRequest) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const parsed = parseSearchParams(req, communityPlayersQuerySchema)
    if (!parsed.ok) return parsed.response

    return communityJson(await listCommunityPlayers(tenant, userId, parsed.data))
  })
}
