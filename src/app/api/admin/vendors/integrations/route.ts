import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  attachVenueIntegrationForAdmin,
  listVenueIntegrationsForAdmin,
} from "@/server/admin/vendors-service"
import {
  mapOperatorError,
  operatorJson,
} from "@/server/operator/http"
import { resolveAdminApiContext } from "@/server/admin/api-context"

const attachSchema = z.object({
  locationId: z.string().uuid(),
  vendorId: z.string().uuid(),
  status: z.enum(["active", "inactive", "pending"]).optional(),
  config: z.record(z.unknown()).nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const locationId = req.nextUrl.searchParams.get("locationId") ?? undefined
    const integrations = await listVenueIntegrationsForAdmin(
      resolved.context,
      locationId ?? undefined,
    )
    return operatorJson(integrations)
  } catch (error) {
    return mapOperatorError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const body = attachSchema.parse(await req.json())
    const created = await attachVenueIntegrationForAdmin(resolved.context, body)
    return operatorJson(created, 201)
  } catch (error) {
    return mapOperatorError(error)
  }
}
