import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { resolveAdminApiContext } from "@/server/admin/api-context"
import { mapDisplayThemeError } from "@/server/display/http"
import { setVenueDisplayTheme } from "@/server/display/themes-service"
import { operatorJson } from "@/server/operator/http"

type RouteContext = { params: Promise<{ id: string }> }

const bodySchema = z.object({ themeKey: z.string().min(1).max(64) })

/** Sets the main TV theme for a venue. TVs pick it up on their next refresh. */
export async function PUT(req: NextRequest, routeContext: RouteContext) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved
    const { id } = await routeContext.params
    const { themeKey } = bodySchema.parse(await req.json().catch(() => null))
    const theme = await setVenueDisplayTheme(resolved.context, { locationId: id, themeKey })
    return operatorJson({ locationId: id, theme })
  } catch (error) {
    return mapDisplayThemeError(error)
  }
}
