import { AdminMembersDashboard } from "@/components/admin/admin-members-dashboard"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { listMembersForAdmin } from "@/server/admin/members-service"
import { requireAdminPageAccess } from "@/server/admin/gate"

export const dynamic = "force-dynamic"

export default async function AdminMembersPage() {
  const access = await requireAdminPageAccess()
  const members = await listMembersForAdmin(access.context)

  return (
    <AdminShell
      title="Members"
      subtitle="Search, manage, and onboard platform members."
      backHref="/admin"
      user={adminShellUser(access)}
    >
      <AdminMembersDashboard members={members} canManage={access.canManageMembers} />
    </AdminShell>
  )
}
