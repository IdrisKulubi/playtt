import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { resolveAccessAdminContext } from "@/server/access/admin-api-context"
import { assignTtlockLockToAccessPoint } from "@/server/access/admin-service"
import { ACCESS_FEATURE_KEYS } from "@/server/access/feature-policy"
import { mapOperatorError, operatorJson } from "@/server/operator/http"

const assignmentSchema = z.object({
  lockId: z.string().uuid(),
  accessPointId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAccessAdminContext(req, {
      feature: ACCESS_FEATURE_KEYS.ttlockProvider,
    })
    if ("error" in resolved) return resolved.error
    const assignment = await assignTtlockLockToAccessPoint(
      resolved.context,
      assignmentSchema.parse(await req.json()),
    )
    return operatorJson({ assignment })
  } catch (error) {
    return mapOperatorError(error)
  }
}
