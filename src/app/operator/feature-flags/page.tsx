import { OperatorFeatureFlagTable } from "@/components/operator/operator-feature-flag-table"
import { OperatorShell } from "@/components/operator/operator-shell"
import { requireOperatorPageAccess } from "@/server/operator/gate"
import { listFeatureFlags } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function OperatorFeatureFlagsPage() {
  const { context } = await requireOperatorPageAccess()
  const featureFlags = await listFeatureFlags(context)

  return (
    <OperatorShell title="Feature flags" eyebrow="Operator" backHref="/operator">
      <OperatorFeatureFlagTable featureFlags={featureFlags} />
    </OperatorShell>
  )
}
