import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  createVendorForAdmin,
  listVendorsForAdmin,
} from "@/server/admin/vendors-service"
import {
  mapOperatorError,
  operatorJson,
} from "@/server/operator/http"
import { resolveAdminApiContext } from "@/server/admin/api-context"

const createVendorSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["ttlock", "camera", "esp32", "paystack", "other"]),
  notes: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const vendors = await listVendorsForAdmin(resolved.context)
    return operatorJson(vendors)
  } catch (error) {
    return mapOperatorError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const body = createVendorSchema.parse(await req.json())
    const created = await createVendorForAdmin(resolved.context, body)
    return operatorJson(created, 201)
  } catch (error) {
    return mapOperatorError(error)
  }
}
