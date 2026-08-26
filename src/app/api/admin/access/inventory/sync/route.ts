import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { resolveAccessAdminContext } from "@/server/access/admin-api-context"
import { syncTtlockInventory } from "@/server/access/admin-service"
import { ACCESS_FEATURE_KEYS } from "@/server/access/feature-policy"
import { mapOperatorError, operatorJson } from "@/server/operator/http"

const syncSchema = z.object({ connectionId: z.string().uuid() })

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAccessAdminContext(req, {
      feature: ACCESS_FEATURE_KEYS.ttlockProvider,
    })
    if ("error" in resolved) return resolved.error
    const result = await syncTtlockInventory(
      resolved.context,
      syncSchema.parse(await req.json()),
    )
    return operatorJson({ sync: result }, 202)
  } catch (error) {
    return mapOperatorError(error)
  }
}
