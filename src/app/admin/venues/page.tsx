import Link from "next/link"

import { AdminShell } from "@/components/admin/admin-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listVenues } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function AdminVenuesPage() {
  const { context, canManageCatalog } = await requireAdminPageAccess()
  const venues = await listVenues(context)

  return (
    <AdminShell title="Venues" eyebrow="Catalog" backHref="/admin">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>All venues</CardTitle>
            {canManageCatalog ? (
              <Button asChild size="sm">
                <Link href="/admin/venues/new">Add venue</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {venues.length === 0 ? (
              <div className="space-y-3 py-4 text-center">
                <p className="text-sm text-muted-foreground">No venues configured yet.</p>
                {canManageCatalog ? (
                  <Button asChild>
                    <Link href="/admin/venues/new">Add your first venue</Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              venues.map((venue) => (
                <Link
                  key={venue.id}
                  href={`/admin/venues/${venue.id}`}
                  className="flex items-center justify-between rounded-2xl border border-white/8 px-4 py-3 transition hover:border-white/16"
                >
                  <div>
                    <p className="font-medium">{venue.name}</p>
                    <p className="text-sm text-muted-foreground">{venue.address}</p>
                  </div>
                  {!venue.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
