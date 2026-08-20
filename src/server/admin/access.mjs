import { canPerformTenantAction } from "../tenancy/permissions-core.mjs"

export const ADMIN_SHELL_FLAG_KEY = "operator_shell"

export function canAccessAdminShell(role) {
  return canPerformTenantAction(role, "analytics.read")
}

export function canManageAdminPlatform(role) {
  return role === "owner"
}
