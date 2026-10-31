import { type NextRequest } from "next/server"

import {
  communityJson,
  communityReportSchema,
  parseJsonBody,
  withCommunityUser,
} from "@/server/community/http"
import { createCommunityReport } from "@/server/community/service"

export async function POST(req: NextRequest) {
  return withCommunityUser(req, async ({ userId, tenant }) => {
    const parsed = await parseJsonBody(req, communityReportSchema)
    if (!parsed.ok) return parsed.response

    return communityJson(await createCommunityReport(tenant, userId, parsed.data), 201)
  })
}
