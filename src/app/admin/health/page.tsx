import { AdminTenantHealthOverview } from "@/components/admin/admin-health-overview"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { getTenantHealthOverview } from "@/server/operations/health-service"

export const dynamic = "force-dynamic"

export default async function AdminHealthPage() {
  const access = await requireAdminPageAccess()
  const overview = await getTenantHealthOverview(access.context)

  return (
    <AdminShell
      title="Health"
      subtitle="Tenant and venue health for devices, edge, sessions, workers, and replay."
      backHref="/admin"
      user={adminShellUser(access)}
    >
      <AdminTenantHealthOverview overview={overview} />
    </AdminShell>
  )
}
