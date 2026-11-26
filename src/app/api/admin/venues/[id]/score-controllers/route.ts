import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { resolveAdminApiContext } from "@/server/admin/api-context"
import {
  getScoreControllersView,
  saveScoreControllerPlacement,
} from "@/server/devices/score-controllers"
import { mapOperatorError, operatorJson } from "@/server/operator/http"

type RouteContext = { params: Promise<{ id: string }> }

const placementSchema = z.object({
  tables: z
    .array(
      z.object({
        tableId: z.string().uuid(),
        controllerId: z.string().uuid().nullable(),
      }),
    )
    .min(1)
    .max(200),
})

/** Score controllers at this venue, its tables, and controllers elsewhere. */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved
    const { id } = await params
    return operatorJson({ view: await getScoreControllersView(resolved.context, id) })
  } catch (error) {
    return mapOperatorError(error)
  }
}

/** Puts controllers on tables (a controller on another table moves; send both rows to swap). */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved
    const { id } = await params
    const body = placementSchema.parse(await req.json())
    return operatorJson(await saveScoreControllerPlacement(resolved.context, id, body.tables))
  } catch (error) {
    return mapOperatorError(error)
  }
}
