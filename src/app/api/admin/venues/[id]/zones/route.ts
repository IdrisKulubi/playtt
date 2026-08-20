import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  mapOperatorError,
  operatorJson,
} from "@/server/operator/http"
import { resolveAdminApiContext } from "@/server/admin/api-context"
import { createZoneForCatalog } from "@/server/catalog/venues-service"

const createZoneSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const { id: locationId } = await params
    const body = createZoneSchema.parse(await req.json())
    const created = await createZoneForCatalog(resolved.context, {
      locationId,
      ...body,
    })

    return operatorJson({ id: created.id, name: created.name }, 201)
  } catch (error) {
    return mapOperatorError(error)
  }
}
