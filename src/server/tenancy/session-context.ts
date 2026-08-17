import { headers } from "next/headers"

import { auth } from "../../../auth"
import { createCorrelationId } from "@/server/tenancy/correlation"
import { resolvePlayTtPublicContext } from "@/server/tenancy/context-factory"
import { resolveRequestTenantContext } from "@/server/tenancy/resolve-request-context"
import { resolveTenantContextForUserId } from "@/server/tenancy/resolve-user-context"
import type { TenantContext } from "@/server/tenancy/types"

export { resolveTenantContextForUserId }

export async function resolveTenantContextFromWebSession(): Promise<TenantContext> {
  const session = await auth.api.getSession({ headers: await headers() })
  return resolveRequestTenantContext({
    userId: session?.user?.id,
    correlationId: createCorrelationId(),
  })
}

export async function resolvePublicCatalogContext(): Promise<TenantContext> {
  return resolvePlayTtPublicContext({
    correlationId: createCorrelationId(),
  }) as TenantContext
}

export async function resolveTenantContextForSessionUser(
  userId: string,
  clientTenantId?: string | null,
): Promise<TenantContext> {
  return resolveRequestTenantContext({
    userId,
    correlationId: createCorrelationId(),
    clientTenantId,
  })
}
