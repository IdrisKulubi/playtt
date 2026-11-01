import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { resolveAdminApiContext } from "@/server/admin/api-context"
import { applyCommunityReportAction } from "@/server/community/admin-service"
import { isCommunityError } from "@/server/community/errors"
import { mapOperatorError, operatorError, operatorJson } from "@/server/operator/http"

type RouteContext = {
  params: Promise<{ reportId: string }>
}

const actionSchema = z.object({
  action: z.enum(["review", "mute", "hide"]),
})

export async function POST(req: NextRequest, routeContext: RouteContext) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const { reportId } = await routeContext.params
    const body = actionSchema.parse(await req.json())
    return operatorJson(
      await applyCommunityReportAction(resolved.context, resolved.userId, { reportId, action: body.action }),
    )
  } catch (error) {
    if (isCommunityError(error)) return operatorError(error)
    return mapOperatorError(error)
  }
}
