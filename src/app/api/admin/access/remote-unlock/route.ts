import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod/v3"

import { accessAdminNoStoreHeaders } from "@/server/access/admin-contract"
import { resolveAccessAdminContext } from "@/server/access/admin-api-context"
import { remoteUnlock } from "@/server/access/admin-service"
import { ACCESS_FEATURE_KEYS } from "@/server/access/feature-policy"
import { mapOperatorError } from "@/server/operator/http"

const unlockSchema = z.object({
  lockId: z.string().uuid(),
  accessPointId: z.string().uuid(),
  reason: z.string().trim().min(10).max(500),
  otpChallengeId: z.string().uuid(),
  otpCode: z.string().regex(/^\d{6}$/),
})

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAccessAdminContext(req, {
      feature: ACCESS_FEATURE_KEYS.remoteUnlock,
      remoteUnlock: true,
    })
    if ("error" in resolved) return resolved.error
    const result = await remoteUnlock(
      resolved.context,
      unlockSchema.parse(await req.json()),
    )
    return NextResponse.json(
      { data: { operation: result } },
      { status: 202, headers: accessAdminNoStoreHeaders },
    )
  } catch (error) {
    return mapOperatorError(error)
  }
}
