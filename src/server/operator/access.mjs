import { canPerformTenantAction } from "../tenancy/permissions-core.mjs"

export const OPERATOR_SHELL_FLAG_KEY = "operator_shell"

export function canAccessOperatorShell(role) {
  return canPerformTenantAction(role, "catalog.read")
}
