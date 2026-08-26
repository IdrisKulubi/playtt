import { type NextRequest, NextResponse } from "next/server"

import { accessAdminNoStoreHeaders } from "@/server/access/admin-contract"
import { resolveAccessAdminContext } from "@/server/access/admin-api-context"
import { requestRemoteUnlockOtp } from "@/server/access/admin-service"
import { ACCESS_FEATURE_KEYS } from "@/server/access/feature-policy"
import { mapOperatorError } from "@/server/operator/http"

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAccessAdminContext(req, {
      feature: ACCESS_FEATURE_KEYS.remoteUnlock,
      remoteUnlock: true,
    })
    if ("error" in resolved) return resolved.error
    const challenge = await requestRemoteUnlockOtp(resolved.context)
    return NextResponse.json(
      { data: { challenge } },
      { status: 201, headers: accessAdminNoStoreHeaders },
    )
  } catch (error) {
    return mapOperatorError(error)
  }
}
