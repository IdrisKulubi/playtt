import { and, asc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { locations } from "@/db/schema"
import { AdminCommunityEventsPanel } from "@/components/admin/admin-community-events-panel"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listEventsForAdmin } from "@/server/community/group-service"

export const dynamic = "force-dynamic"

export default async function AdminCommunityEventsPage() {
  const access = await requireAdminPageAccess()
  const [events, venues] = await Promise.all([
    listEventsForAdmin(access.context),
    db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(and(eq(locations.tenantId, access.context.tenantId), eq(locations.isActive, true)))
      .orderBy(asc(locations.name)),
  ])

  return (
    <AdminShell
      title="Community events"
      subtitle="Create group events players can join from the Community tab."
      backHref="/admin"
      user={adminShellUser(access)}
      searchable={false}
    >
      <AdminCommunityEventsPanel events={events} venues={venues} />
    </AdminShell>
  )
}
