import { rejectClientTenantId } from "./membership-context.mjs"
import { resolvePlayTtMembershipForUser } from "./resolve-membership"
import { TenancyError } from "./errors"
import type { TenantContext } from "./types"

export async function resolveRequestTenantContext(input: {
  userId?: string | null
  correlationId: string
  clientTenantId?: string | null
}): Promise<TenantContext> {
  rejectClientTenantId(input.clientTenantId)

  if (!input.userId) {
    throw new TenancyError(
      "NOT_AUTHENTICATED",
      "Sign in is required for tenant-scoped operations.",
    )
  }

  return resolvePlayTtMembershipForUser({
    userId: input.userId,
    correlationId: input.correlationId,
    clientTenantId: input.clientTenantId,
  })
}
