import { AdminActiveAlertsStrip } from "@/components/admin/admin-alerts-panel"
import { AdminTenantHealthOverview } from "@/components/admin/admin-health-overview"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { buildTenantOperationalAlertsFromOverview } from "@/server/operations/alerts-service"
import { getTenantHealthOverview } from "@/server/operations/health-service"

export const dynamic = "force-dynamic"

export default async function AdminHealthPage() {
  const access = await requireAdminPageAccess()
  const overview = await getTenantHealthOverview(access.context)
  const alertsOverview = buildTenantOperationalAlertsFromOverview(overview)

  return (
    <AdminShell
      title="Health"
      subtitle="How every venue, device and service is doing right now."
      backHref="/admin"
      user={adminShellUser(access)}
    >
      <AdminTenantHealthOverview overview={overview}>
        <AdminActiveAlertsStrip alertsOverview={alertsOverview} />
      </AdminTenantHealthOverview>
    </AdminShell>
  )
}
