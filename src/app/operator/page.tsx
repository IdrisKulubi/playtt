import { OperatorOverviewCards, OperatorVenueList } from "@/components/operator/operator-overview"
import { OperatorShell } from "@/components/operator/operator-shell"
import { requireOperatorPageAccess } from "@/server/operator/gate"
import { getCatalogOverview } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function OperatorOverviewPage() {
  const { context } = await requireOperatorPageAccess()
  const overview = await getCatalogOverview(context)

  return (
    <OperatorShell title="Catalog overview" eyebrow="Operator">
      <div className="space-y-6">
        <OperatorOverviewCards overview={overview} />
        <OperatorVenueList overview={overview} />
      </div>
    </OperatorShell>
  )
}
