import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod/v3"

import { accessAdminNoStoreHeaders } from "@/server/access/admin-contract"
import { resolveAccessAdminContext } from "@/server/access/admin-api-context"
import { syncTtlockUnlockRecords } from "@/server/access/admin-service"
import { ACCESS_FEATURE_KEYS } from "@/server/access/feature-policy"
import { mapOperatorError } from "@/server/operator/http"

const syncSchema = z.object({
  connectionId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAccessAdminContext(req, {
      feature: ACCESS_FEATURE_KEYS.ttlockProvider,
    })
    if ("error" in resolved) return resolved.error
    const result = await syncTtlockUnlockRecords(
      resolved.context,
      syncSchema.parse(await req.json()),
    )
    return NextResponse.json(
      { data: { sync: result } },
      { status: 202, headers: accessAdminNoStoreHeaders },
    )
  } catch (error) {
    return mapOperatorError(error)
  }
}
