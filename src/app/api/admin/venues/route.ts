import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  mapOperatorError,
  operatorJson,
} from "@/server/operator/http"
import { resolveAdminApiContext } from "@/server/admin/api-context"
import { createVenueForCatalog } from "@/server/catalog/venues-service"

const createVenueSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  address: z.string().min(1),
  timezone: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const body = createVenueSchema.parse(await req.json())
    const created = await createVenueForCatalog(resolved.context, body)

    return operatorJson({
      id: created.id,
      name: created.name,
      slug: created.slug,
    }, 201)
  } catch (error) {
    return mapOperatorError(error)
  }
}
