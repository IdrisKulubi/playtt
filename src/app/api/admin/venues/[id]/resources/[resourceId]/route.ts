import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { mapOperatorError, operatorJson } from "@/server/operator/http"
import { resolveAdminApiContext } from "@/server/admin/api-context"
import { updateResourceForCatalog } from "@/server/catalog/venues-service"

const updateResourceSchema = z.object({
  name: z.string().trim().min(1, "Enter a table name.").max(80),
})

type RouteContext = { params: Promise<{ id: string; resourceId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const { id: locationId, resourceId } = await params
    const body = updateResourceSchema.parse(await req.json())
    const updated = await updateResourceForCatalog(resolved.context, {
      resourceId,
      locationId,
      name: body.name,
    })

    return operatorJson({ id: updated.id, name: updated.name })
  } catch (error) {
    return mapOperatorError(error)
  }
}
