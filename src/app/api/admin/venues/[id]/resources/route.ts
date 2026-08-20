import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  mapOperatorError,
  operatorJson,
} from "@/server/operator/http"
import { resolveAdminApiContext } from "@/server/admin/api-context"
import { createResourceForCatalog } from "@/server/catalog/venues-service"

const createResourceSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  code: z.string().nullable().optional(),
  zoneId: z.string().uuid().nullable().optional(),
  resourceTypeId: z.string().uuid().nullable().optional(),
  type: z.enum(["pod", "table", "room", "tablet", "display"]).optional(),
  ruleset: z.string().nullable().optional(),
  capacity: z.number().int().min(1).max(20).optional(),
  sortOrder: z.number().int().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const { id: locationId } = await params
    const body = createResourceSchema.parse(await req.json())
    const created = await createResourceForCatalog(resolved.context, {
      locationId,
      ...body,
    })

    return operatorJson({ id: created.id, name: created.name }, 201)
  } catch (error) {
    return mapOperatorError(error)
  }
}
