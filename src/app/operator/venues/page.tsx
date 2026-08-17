import Link from "next/link"

import { OperatorShell } from "@/components/operator/operator-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireOperatorPageAccess } from "@/server/operator/gate"
import { listVenues } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function OperatorVenuesPage() {
  const { context } = await requireOperatorPageAccess()
  const venues = await listVenues(context)

  return (
    <OperatorShell title="Venues" eyebrow="Operator" backHref="/operator">
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
                href={`/operator/venues/${venue.id}`}
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
    </OperatorShell>
  )
}
