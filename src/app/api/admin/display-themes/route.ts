import { type NextRequest } from "next/server"

import { resolveAdminApiContext } from "@/server/admin/api-context"
import { mapDisplayThemeError, themeInputSchema } from "@/server/display/http"
import {
  createDisplayTheme,
  getDisplayThemesOverview,
} from "@/server/display/themes-service"
import { operatorJson } from "@/server/operator/http"

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved
    return operatorJson(await getDisplayThemesOverview(resolved.context))
  } catch (error) {
    return mapDisplayThemeError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved
    const input = themeInputSchema.parse(await req.json().catch(() => null))
    const theme = await createDisplayTheme(
      { ...resolved.context, userId: resolved.userId },
      input,
    )
    return operatorJson(theme, 201)
  } catch (error) {
    return mapDisplayThemeError(error)
  }
}
