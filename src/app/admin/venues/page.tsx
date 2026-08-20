import Link from "next/link"

import { AdminShell } from "@/components/admin/admin-shell"
import { AdminCreateVenueForm } from "@/components/admin/admin-catalog-forms"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listVenues } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function AdminVenuesPage() {
  const { context, isOwner } = await requireAdminPageAccess()
  const venues = await listVenues(context)

  return (
    <AdminShell title="Venues" eyebrow="Catalog" backHref="/admin">
      <div className="space-y-6">
        {isOwner ? (
          <div className="flex justify-end">
            <Button asChild>
              <Link href="/admin/venues/new">Add venue</Link>
            </Button>
          </div>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>All venues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {venues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No venues configured.</p>
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
