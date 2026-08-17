import { OperatorDurableWorkPanel } from "@/components/operator/operator-durable-work-panel"
import { OperatorShell } from "@/components/operator/operator-shell"
import { getDurableWorkOverview } from "@/server/operator/durable-work-service"
import { requireOperatorPageAccess } from "@/server/operator/gate"

export const dynamic = "force-dynamic"

export default async function OperatorDurableWorkPage() {
  const { context } = await requireOperatorPageAccess()
  const overview = await getDurableWorkOverview(context)

  return (
    <OperatorShell
      title="Durable work"
      eyebrow="Operator"
      backHref="/operator"
    >
      <OperatorDurableWorkPanel
        inboxBacklog={overview.inboxBacklog}
        outboxBacklog={overview.outboxBacklog}
        deadLetterInbox={overview.deadLetterInbox}
        deadLetterOutbox={overview.deadLetterOutbox}
      />
    </OperatorShell>
  )
}
