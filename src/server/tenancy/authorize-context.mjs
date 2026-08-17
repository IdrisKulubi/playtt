import { authorizeTenantAction } from "./authorize.mjs"
import { TenancyError } from "./errors.ts"
import { requireTenantContext } from "./require-context.mjs"

const PUBLIC_CATALOG_ACTIONS = new Set(["venue.read", "booking.read"])

export function authorize(context, action) {
  const trustedContext = requireTenantContext(context)

  if (trustedContext.role) {
    authorizeTenantAction(trustedContext.role, action)
    return trustedContext
  }

  if (
    trustedContext.actor.type === "service" &&
    trustedContext.actor.id === "public-catalog"
  ) {
    if (!PUBLIC_CATALOG_ACTIONS.has(action)) {
      throw new TenancyError(
        "FORBIDDEN_ACTION",
        `Public catalog context cannot perform ${action}.`,
      )
    }

    return trustedContext
  }

  if (trustedContext.actor.type === "service") {
    return trustedContext
  }

  throw new TenancyError(
    "NOT_AUTHENTICATED",
    "Authenticated membership is required for this action.",
  )
}
