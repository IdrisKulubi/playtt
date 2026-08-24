import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { acknowledgeOperationalAlert } from "@/server/operations/alert-actions-service"
import { resolveAdminApiContext } from "@/server/admin/api-context"
import {
  mapOperatorError,
  operatorJson,
} from "@/server/operator/http"

const acknowledgeSchema = z.object({
  alertId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const body = acknowledgeSchema.parse(await req.json())
    const result = await acknowledgeOperationalAlert(resolved.context, body)
    return operatorJson(result)
  } catch (error) {
    return mapOperatorError(error)
  }
}
