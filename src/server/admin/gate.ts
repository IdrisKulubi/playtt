import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "../../../auth"
import {
  canAccessAdminShell,
  canManageAdminPlatform,
} from "@/server/admin/access.mjs"
import { isOperatorShellEnabledForTenant } from "@/server/operator/feature-policy"
import { resolveTenantContextFromWebSession } from "@/server/tenancy/session-context"
import type { TenantContext } from "@/server/tenancy/types"

export type AdminPageAccess = {
  userId: string
  context: TenantContext
  isOwner: boolean
}

export async function requireAdminPageAccess(): Promise<AdminPageAccess> {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/admin")
  }

  const context = await resolveTenantContextFromWebSession()

  if (!(await isOperatorShellEnabledForTenant(context))) {
    redirect("/dashboard")
  }

  if (!canAccessAdminShell(context.role)) {
    redirect("/dashboard")
  }

  return {
    userId: session.user.id,
    context,
    isOwner: canManageAdminPlatform(context.role),
  }
}

export async function requireOwnerAdminAccess(): Promise<AdminPageAccess> {
  const access = await requireAdminPageAccess()

  if (!access.isOwner) {
    redirect("/dashboard")
  }

  return access
}
