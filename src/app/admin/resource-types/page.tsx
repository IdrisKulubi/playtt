import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { Badge } from "@/components/ui/badge"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listResourceTypes } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function AdminResourceTypesPage() {
  const access = await requireAdminPageAccess()
  const resourceTypes = await listResourceTypes(access.context)

  return (
    <AdminShell
      title="Resource types"
      subtitle="Catalog resource types used across venues."
      backHref="/admin"
      user={adminShellUser(access)}
      searchable={false}
    >
      <div className="admin-dashboard-card">
        <div className="space-y-3">
          {resourceTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resource types configured.</p>
          ) : (
            resourceTypes.map((type) => (
              <div
                key={type.id}
                className="flex items-start justify-between rounded-2xl border border-border px-4 py-3"
              >
                <div>
                  <p className="font-medium">{type.name}</p>
                  {type.description ? (
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  ) : null}
                </div>
                <Badge variant="outline">{type.code}</Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminShell>
  )
}
