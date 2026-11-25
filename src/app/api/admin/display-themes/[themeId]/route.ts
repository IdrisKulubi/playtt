import { type NextRequest } from "next/server"

import { resolveAdminApiContext } from "@/server/admin/api-context"
import { mapDisplayThemeError, themeInputSchema } from "@/server/display/http"
import {
  deleteDisplayTheme,
  updateDisplayTheme,
} from "@/server/display/themes-service"
import { operatorJson } from "@/server/operator/http"

type RouteContext = { params: Promise<{ themeId: string }> }

export async function PATCH(req: NextRequest, routeContext: RouteContext) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved
    const { themeId } = await routeContext.params
    const input = themeInputSchema.parse(await req.json().catch(() => null))
    return operatorJson(await updateDisplayTheme(resolved.context, themeId, input))
  } catch (error) {
    return mapDisplayThemeError(error)
  }
}

export async function DELETE(req: NextRequest, routeContext: RouteContext) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved
    const { themeId } = await routeContext.params
    await deleteDisplayTheme(resolved.context, themeId)
    return operatorJson({ deleted: true })
  } catch (error) {
    return mapDisplayThemeError(error)
  }
}
