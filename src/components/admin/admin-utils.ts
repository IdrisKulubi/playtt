import type { AdminPageAccess } from "@/server/admin/gate"

export function adminShellUser(access: AdminPageAccess) {
  return {
    name: access.userName,
    email: access.userEmail,
  }
}
