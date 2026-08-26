import { type NextRequest } from "next/server"

import { resolveAdminApiContext } from "@/server/admin/api-context"
import {
  ACCESS_FEATURE_KEYS,
  type AccessFeatureKey,
  isAccessFeatureEnabled,
} from "@/server/access/feature-policy"
import { operatorError } from "@/server/operator/http"
import { canPerformTenantAction } from "@/server/tenancy/permissions"

export async function resolveAccessAdminContext(
  req: NextRequest,
  options: {
    feature?: AccessFeatureKey
    remoteUnlock?: boolean
  } = {},
) {
  const resolved = await resolveAdminApiContext(req)
  if ("status" in resolved) return { error: resolved } as const

  if (!canPerformTenantAction(resolved.context.role, "venue.manage")) {
    return {
      error: operatorError({
        code: "FORBIDDEN_ACTION",
        message: "You do not have permission to manage venue access.",
        status: 403,
      }),
    } as const
  }

  const feature = options.feature ?? ACCESS_FEATURE_KEYS.liveAccess
  if (!(await isAccessFeatureEnabled(resolved.context, feature))) {
    return {
      error: operatorError({
        code: "FEATURE_DISABLED",
        message: "This access feature is not enabled for the tenant.",
        status: 403,
      }),
    } as const
  }

  if (
    options.remoteUnlock &&
    !canPerformTenantAction(resolved.context.role, "access.remote_unlock")
  ) {
    return {
      error: operatorError({
        code: "FORBIDDEN_ACTION",
        message: "You do not have permission to unlock venue doors remotely.",
        status: 403,
      }),
    } as const
  }

  return resolved
}
