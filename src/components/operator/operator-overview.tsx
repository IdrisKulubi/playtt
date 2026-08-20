import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { OperatorCatalogOverview } from "@/server/operator/types"

export function OperatorOverviewCards({
  overview,
}: {
  overview: OperatorCatalogOverview
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle>Tenant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-lg font-semibold">{overview.tenant.name}</p>
          <p className="text-sm text-muted-foreground">{overview.tenant.slug}</p>
          <Badge variant="outline">{overview.tenant.status}</Badge>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Venues</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{overview.venues.length}</p>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Resource types</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{overview.resourceTypeCount}</p>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Memberships</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{overview.membershipCount}</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function OperatorVenueList({
  overview,
  venueHrefPrefix = "/operator/venues",
}: {
  overview: OperatorCatalogOverview
  venueHrefPrefix?: string
}) {
  if (overview.venues.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          No venues configured for this tenant yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Venue catalog</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {overview.venues.map(({ venue, zoneCount, resourceCount, capabilityCount }) => (
          <Link
            key={venue.id}
            href={`${venueHrefPrefix}/${venue.id}`}
            className="flex items-center justify-between rounded-2xl border border-white/8 bg-background/40 px-4 py-3 transition hover:border-white/16"
          >
            <div>
              <p className="font-medium">{venue.name}</p>
              <p className="text-sm text-muted-foreground">{venue.address}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{zoneCount} zones</span>
              <span>{resourceCount} resources</span>
              <span>{capabilityCount} capabilities</span>
              {!venue.isActive ? <Badge variant="outline">Inactive</Badge> : null}
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
