import { AdminAlertsPanel } from "@/components/admin/admin-alerts-panel"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { getAlertDispatchStatus } from "@/server/operations/alert-dispatch-service"
import { listAcknowledgedAlertIds } from "@/server/operations/alert-actions-service"
import { getTenantOperationalAlerts } from "@/server/operations/alerts-service"

export const dynamic = "force-dynamic"

export default async function AdminAlertsPage() {
  const access = await requireAdminPageAccess()
  const [alertsOverview, dispatchStatus, acknowledgedAlertIds] =
    await Promise.all([
      getTenantOperationalAlerts(access.context),
      getAlertDispatchStatus(access.context),
      listAcknowledgedAlertIds(access.context),
    ])

  return (
    <AdminShell
      title="Alerts"
      subtitle="Active operational alerts derived from tenant health with recovery runbooks."
      backHref="/admin/health"
      user={adminShellUser(access)}
    >
      <AdminAlertsPanel
        alertsOverview={alertsOverview}
        dispatchStatus={dispatchStatus}
        acknowledgedAlertIds={acknowledgedAlertIds}
      />
    </AdminShell>
  )
}
