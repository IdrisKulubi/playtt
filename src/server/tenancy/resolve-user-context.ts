import { createCorrelationId } from "./correlation"
import { resolveRequestTenantContext } from "./resolve-request-context"

export async function resolveTenantContextForUserId(userId: string) {
  return resolveRequestTenantContext({
    userId,
    correlationId: createCorrelationId(),
  })
}
