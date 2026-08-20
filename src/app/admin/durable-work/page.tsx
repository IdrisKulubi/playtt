import { OperatorDurableWorkPanel } from "@/components/operator/operator-durable-work-panel"
import { AdminShell } from "@/components/admin/admin-shell"
import { getDurableWorkOverview } from "@/server/operator/durable-work-service"
import { requireAdminPageAccess } from "@/server/admin/gate"

export const dynamic = "force-dynamic"

export default async function AdminDurableWorkPage() {
  const { context } = await requireAdminPageAccess()
  const overview = await getDurableWorkOverview(context)

  return (
    <AdminShell title="Durable work" eyebrow="System" backHref="/admin">
      <OperatorDurableWorkPanel
        inboxBacklog={overview.inboxBacklog}
        outboxBacklog={overview.outboxBacklog}
        deadLetterInbox={overview.deadLetterInbox}
        deadLetterOutbox={overview.deadLetterOutbox}
      />
    </AdminShell>
  )
}
