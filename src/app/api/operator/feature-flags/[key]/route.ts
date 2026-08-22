import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { getSessionWithBearerFallback } from "@/lib/security"
import { canAccessOperatorShell } from "@/server/operator/access.mjs"
import { isOperatorShellEnabledForTenant } from "@/server/operator/feature-policy"
import {
  mapOperatorError,
  operatorError,
  operatorJson,
} from "@/server/operator/http"
import { setFeatureFlagEnabled } from "@/server/operator/service"
import { canPerformTenantAction } from "@/server/tenancy/permissions"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

const bodySchema = z.object({
  enabled: z.boolean(),
})

type RouteContext = {
  params: Promise<{ key: string }>
}

export async function PATCH(req: NextRequest, routeContext: RouteContext) {
  try {
    const session = await getSessionWithBearerFallback(req)

    if (!session) {
      return operatorError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    const context = await resolveTenantContextForSessionUser(
      session.user.id,
      req.headers.get("x-tenant-id"),
    )

    if (!(await isOperatorShellEnabledForTenant(context))) {
      return operatorError({
        code: "FORBIDDEN_ACTION",
        message: "Operator shell is not enabled for this tenant.",
        status: 403,
      })
    }

    if (!canAccessOperatorShell(context.role)) {
      return operatorError({
        code: "FORBIDDEN_ACTION",
        message: "You do not have permission to manage feature flags.",
        status: 403,
      })
    }

    if (!canPerformTenantAction(context.role, "catalog.manage")) {
      return operatorError({
        code: "FORBIDDEN_ACTION",
        message: "You do not have permission to manage feature flags.",
        status: 403,
      })
    }

    const body = bodySchema.parse(await req.json())
    const { key } = await routeContext.params
    const featureFlag = await setFeatureFlagEnabled(
      context,
      decodeURIComponent(key),
      body.enabled,
    )

    return operatorJson(featureFlag)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unknown feature flag")) {
      return operatorError({
        code: "INVALID_FEATURE_FLAG",
        message: error.message,
        status: 400,
      })
    }

    return mapOperatorError(error)
  }
}
