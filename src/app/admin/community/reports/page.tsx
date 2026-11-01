import { AdminCommunityReportsPanel } from "@/components/admin/admin-community-reports-panel"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listCommunityReportsForAdmin } from "@/server/community/admin-service"

export const dynamic = "force-dynamic"

export default async function AdminCommunityReportsPage() {
  const access = await requireAdminPageAccess()
  const reports = await listCommunityReportsForAdmin(access.context)

  return (
    <AdminShell
      title="Community reports"
      subtitle="Review player reports, mute or hide cards, and excuse missed bookings."
      backHref="/admin"
      user={adminShellUser(access)}
      searchable={false}
    >
      <AdminCommunityReportsPanel reports={reports} />
    </AdminShell>
  )
}
