import { notFound } from "next/navigation"

import {
  AdminMemberDetailForm,
} from "@/components/admin/admin-members-panel"
import { AdminShell } from "@/components/admin/admin-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMemberForAdmin } from "@/server/admin/members-service"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listVenues } from "@/server/operator/service"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminMemberDetailPage({ params }: PageProps) {
  const { id } = await params
  const { context, isOwner } = await requireAdminPageAccess()
  const member = await getMemberForAdmin(context, id)

  if (!member) {
    notFound()
  }

  const venues = await listVenues(context)

  return (
    <AdminShell title={member.name} eyebrow="Member" backHref="/admin/members">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{member.email}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">{member.role}</Badge>
            <Badge variant={member.status === "active" ? "default" : "secondary"}>
              {member.status}
            </Badge>
          </CardContent>
        </Card>
        <AdminMemberDetailForm
          member={member}
          venues={venues.map((venue) => ({ id: venue.id, name: venue.name }))}
          canManage={isOwner}
        />
      </div>
    </AdminShell>
  )
}
