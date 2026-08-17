import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import { canAccessOperatorShell } from "@/server/operator/access.mjs"
import { isOperatorShellEnabledForTenant } from "@/server/operator/feature-policy"
import {
  mapOperatorError,
  operatorError,
  operatorJson,
} from "@/server/operator/http"
import { listMemberships } from "@/server/operator/service"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

export async function GET(req: NextRequest) {
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
        message: "You do not have permission to inspect operator memberships.",
        status: 403,
      })
    }

    const memberships = await listMemberships(context)
    return operatorJson(memberships)
  } catch (error) {
    return mapOperatorError(error)
  }
}
