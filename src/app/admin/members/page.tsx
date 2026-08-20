import { AdminMembersPanel } from "@/components/admin/admin-members-panel"
import { AdminShell } from "@/components/admin/admin-shell"
import { listMembersForAdmin } from "@/server/admin/members-service"
import { requireAdminPageAccess } from "@/server/admin/gate"

export const dynamic = "force-dynamic"

export default async function AdminMembersPage() {
  const { context, isOwner } = await requireAdminPageAccess()
  const members = await listMembersForAdmin(context)

  return (
    <AdminShell title="Members" eyebrow="People" backHref="/admin">
      <AdminMembersPanel members={members} canManage={isOwner} />
    </AdminShell>
  )
}
