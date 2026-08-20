import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listResourceTypes } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function AdminResourceTypesPage() {
  const { context } = await requireAdminPageAccess()
  const resourceTypes = await listResourceTypes(context)

  return (
    <AdminShell title="Resource types" eyebrow="Settings" backHref="/admin">
      <Card>
        <CardHeader>
          <CardTitle>Catalog resource types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {resourceTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resource types configured.</p>
          ) : (
            resourceTypes.map((type) => (
              <div
                key={type.id}
                className="flex items-start justify-between rounded-2xl border border-white/8 px-4 py-3"
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
        </CardContent>
      </Card>
    </AdminShell>
  )
}
