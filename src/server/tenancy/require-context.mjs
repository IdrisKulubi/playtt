import { TenancyError } from "./errors.ts"

export function requireTenantContext(context) {
  if (!context?.tenantId) {
    throw new TenancyError(
      "NOT_AUTHENTICATED",
      "Tenant context is required for this operation.",
    )
  }

  if (!context.actor?.type || !context.actor?.id) {
    throw new TenancyError(
      "NOT_AUTHENTICATED",
      "Tenant actor is required for this operation.",
    )
  }

  if (!context.correlationId) {
    throw new TenancyError(
      "NOT_AUTHENTICATED",
      "Correlation id is required for tenant context.",
    )
  }

  return context
}
