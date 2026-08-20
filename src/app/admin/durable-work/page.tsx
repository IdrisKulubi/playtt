import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { OperatorDurableWorkPanel } from "@/components/operator/operator-durable-work-panel"
import { getDurableWorkOverview } from "@/server/operator/durable-work-service"
import { requireAdminPageAccess } from "@/server/admin/gate"

export const dynamic = "force-dynamic"

export default async function AdminDurableWorkPage() {
  const access = await requireAdminPageAccess()
  const overview = await getDurableWorkOverview(access.context)

  return (
    <AdminShell
      title="Durable work"
      subtitle="Inbox, outbox, and dead-letter queues."
      backHref="/admin"
      user={adminShellUser(access)}
      searchable={false}
    >
      <div className="admin-dashboard-card p-5">
        <OperatorDurableWorkPanel
          inboxBacklog={overview.inboxBacklog}
          outboxBacklog={overview.outboxBacklog}
          deadLetterInbox={overview.deadLetterInbox}
          deadLetterOutbox={overview.deadLetterOutbox}
        />
      </div>
    </AdminShell>
  )
}
