import { canPerformTenantAction } from "./permissions-core.mjs"
import { TenancyError } from "./errors.ts"

export function authorizeTenantAction(role, action) {
  if (!canPerformTenantAction(role, action)) {
    throw new TenancyError(
      "FORBIDDEN_ACTION",
      `Role ${role} is not allowed to perform ${action}.`,
    )
  }
}
