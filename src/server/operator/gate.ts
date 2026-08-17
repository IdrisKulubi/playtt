import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "../../../auth"
import { canAccessOperatorShell } from "@/server/operator/access.mjs"
import { isOperatorShellEnabledForTenant } from "@/server/operator/feature-policy"
import { resolveTenantContextFromWebSession } from "@/server/tenancy/session-context"
import type { TenantContext } from "@/server/tenancy/types"

export type OperatorPageAccess = {
  userId: string
  context: TenantContext
}

export async function requireOperatorPageAccess(): Promise<OperatorPageAccess> {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/operator")
  }

  const context = await resolveTenantContextFromWebSession()

  if (!(await isOperatorShellEnabledForTenant(context))) {
    redirect("/dashboard")
  }

  if (!canAccessOperatorShell(context.role)) {
    redirect("/dashboard")
  }

  return { userId: session.user.id, context }
}
