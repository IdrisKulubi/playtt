import { OperatorFeatureFlagTable } from "@/components/operator/operator-feature-flag-table"
import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listFeatureFlags } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function AdminFeatureFlagsPage() {
  const { context } = await requireAdminPageAccess()
  const featureFlags = await listFeatureFlags(context)

  return (
    <AdminShell title="Feature flags" eyebrow="Settings" backHref="/admin">
      <OperatorFeatureFlagTable featureFlags={featureFlags} />
    </AdminShell>
  )
}
