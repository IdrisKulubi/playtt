import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type {
  HealthDimension,
  HealthStatus,
  TenantHealthOverview,
  VenueHealthSnapshot,
} from "@/server/operations/health-status"

function healthStatusLabel(status: HealthStatus) {
  switch (status) {
    case "ok":
      return "Healthy"
    case "degraded":
      return "Degraded"
    case "down":
      return "Down"
    case "not_configured":
      return "Not configured"
  }
}

function healthStatusVariant(status: HealthStatus) {
  switch (status) {
    case "ok":
      return "default" as const
    case "degraded":
      return "outline" as const
    case "down":
      return "destructive" as const
    case "not_configured":
      return "secondary" as const
  }
}

function HealthStatusBadge({ status }: { status: HealthStatus }) {
  return (
    <Badge variant={healthStatusVariant(status)}>{healthStatusLabel(status)}</Badge>
  )
}

function HealthDimensionRow({ dimension }: { dimension: HealthDimension }) {
  const content = (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 px-3 py-2.5">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{dimension.label}</p>
          <HealthStatusBadge status={dimension.status} />
        </div>
        <p className="text-sm text-muted-foreground">{dimension.summary}</p>
      </div>
      {dimension.href ? (
        <Button asChild size="sm" variant="ghost" className="shrink-0">
          <Link href={dimension.href}>Open</Link>
        </Button>
      ) : null}
    </div>
  )

  return content
}

export function AdminTenantHealthOverview({
  overview,
}: {
  overview: TenantHealthOverview
}) {
  return (
    <div className="space-y-6">
      <div className="admin-dashboard-card flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Tenant health</p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">
              {healthStatusLabel(overview.status)}
            </h2>
            <HealthStatusBadge status={overview.status} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {new Date(overview.generatedAt).toLocaleString()}
        </p>
      </div>

      {overview.tenantDimensions.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-base font-semibold">Platform workers</h3>
            <p className="text-sm text-muted-foreground">
              Tenant-wide durable work and webhook processing.
            </p>
          </div>
          <div className="grid gap-3">
            {overview.tenantDimensions.map((dimension) => (
              <HealthDimensionRow key={dimension.key} dimension={dimension} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Venues</h3>
          <p className="text-sm text-muted-foreground">
            Device, edge, session, and replay health per venue.
          </p>
        </div>

        {overview.venues.length === 0 ? (
          <div className="admin-dashboard-card">
            <p className="text-sm text-muted-foreground">
              No venues are configured for this tenant yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {overview.venues.map((venue) => (
              <AdminVenueHealthCard key={venue.venueId} venue={venue} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export function AdminVenueHealthCard({
  venue,
}: {
  venue: VenueHealthSnapshot
}) {
  return (
    <article className="admin-dashboard-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{venue.venueName}</h3>
            <HealthStatusBadge status={venue.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Remote diagnosis for devices, edge, sessions, and replay.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/venues/${venue.venueId}`}>Venue detail</Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {venue.dimensions.map((dimension) => (
          <HealthDimensionRow key={dimension.key} dimension={dimension} />
        ))}
      </div>
    </article>
  )
}

export function AdminVenueHealthStrip({
  venue,
}: {
  venue: VenueHealthSnapshot
}) {
  return (
    <section className="admin-dashboard-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Venue health</p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{healthStatusLabel(venue.status)}</h2>
            <HealthStatusBadge status={venue.status} />
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/health">Open health overview</Link>
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {venue.dimensions.map((dimension) => (
          <div
            key={dimension.key}
            className="rounded-xl border border-border/70 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{dimension.label}</p>
              <HealthStatusBadge status={dimension.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{dimension.summary}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
