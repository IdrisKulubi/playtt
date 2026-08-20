import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { OperatorFeatureFlagTable } from "@/components/operator/operator-feature-flag-table"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listFeatureFlags } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function AdminFeatureFlagsPage() {
  const access = await requireAdminPageAccess()
  const featureFlags = await listFeatureFlags(access.context)

  return (
    <AdminShell
      title="Feature flags"
      subtitle="Toggle platform features per tenant."
      backHref="/admin"
      user={adminShellUser(access)}
      searchable={false}
    >
      <div className="admin-dashboard-card p-0">
        <OperatorFeatureFlagTable featureFlags={featureFlags} />
      </div>
    </AdminShell>
  )
}
