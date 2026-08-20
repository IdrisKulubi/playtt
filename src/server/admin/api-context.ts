import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import { canAccessAdminShell } from "@/server/admin/access.mjs"
import { isOperatorShellEnabledForTenant } from "@/server/operator/feature-policy"
import {
  mapOperatorError,
  operatorError,
} from "@/server/operator/http"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"
import type { TenantContext } from "@/server/tenancy/types"

export async function resolveAdminApiContext(req: NextRequest): Promise<
  | { context: TenantContext; userId: string }
  | ReturnType<typeof operatorError>
> {
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
      message: "Admin console is not enabled for this tenant.",
      status: 403,
    })
  }

  if (!canAccessAdminShell(context.role)) {
    return operatorError({
      code: "FORBIDDEN_ACTION",
      message: "You do not have permission to access the admin console.",
      status: 403,
    })
  }

  return { context, userId: session.user.id }
}
