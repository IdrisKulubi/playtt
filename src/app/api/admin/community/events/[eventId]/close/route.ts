import { type NextRequest } from "next/server"

import { resolveAdminApiContext } from "@/server/admin/api-context"
import { closeEvent } from "@/server/community/group-service"
import { mapOperatorError, operatorJson } from "@/server/operator/http"

type RouteContext = {
  params: Promise<{ eventId: string }>
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const { eventId } = await routeContext.params
    return operatorJson(await closeEvent(resolved.context, eventId))
  } catch (error) {
    return mapOperatorError(error)
  }
}
