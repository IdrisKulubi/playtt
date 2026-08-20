import { notFound } from "next/navigation"

import { AdminMemberDetailForm } from "@/components/admin/admin-members-panel"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { Badge } from "@/components/ui/badge"
import { getMemberForAdmin } from "@/server/admin/members-service"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listVenues } from "@/server/operator/service"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminMemberDetailPage({ params }: PageProps) {
  const { id } = await params
  const access = await requireAdminPageAccess()
  const member = await getMemberForAdmin(access.context, id)

  if (!member) {
    notFound()
  }

  const venues = await listVenues(access.context)

  return (
    <AdminShell
      title={member.name}
      subtitle={member.email}
      backHref="/admin/members"
      user={adminShellUser(access)}
      searchable={false}
    >
      <div className="space-y-6">
        <div className="admin-dashboard-card flex flex-wrap gap-2 p-5">
          <Badge variant="outline">{member.role}</Badge>
          <Badge variant={member.status === "active" ? "default" : "secondary"}>
            {member.status}
          </Badge>
        </div>
        <div className="admin-dashboard-card">
          <AdminMemberDetailForm
            member={member}
            venues={venues.map((venue) => ({ id: venue.id, name: venue.name }))}
            canManage={access.canManageMembers}
          />
        </div>
      </div>
    </AdminShell>
  )
}
