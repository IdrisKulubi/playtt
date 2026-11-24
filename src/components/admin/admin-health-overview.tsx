import Link from "next/link"
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr"

import { GroupedList, GroupedSection, LargeTitle, SectionHeader } from "@/components/admin/admin-grouped"
import type {
  HealthDimension,
  HealthStatus,
  TenantHealthOverview,
  VenueHealthSnapshot,
} from "@/server/operations/health-status"

const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: "Healthy",
  degraded: "Degraded",
  down: "Down",
  not_configured: "Not set up",
}

// Fixed locale + zone so this server-rendered text matches the browser.
const checkedFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Nairobi",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})

function needsAttention(status: HealthStatus) {
  return status === "degraded" || status === "down"
}

/** Problems first, then healthy, then not set up; status is a word, emphasised by weight. */
function sortDimensions(dimensions: HealthDimension[]) {
  const rank: Record<HealthStatus, number> = { down: 0, degraded: 1, ok: 2, not_configured: 3 }
  return [...dimensions].sort((a, b) => rank[a.status] - rank[b.status])
}

function DimensionRow({ dimension }: { dimension: HealthDimension }) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[15px]">{dimension.label}</span>
          <span
            className={`shrink-0 text-[15px] ${
              needsAttention(dimension.status) ? "font-semibold text-foreground" : "text-muted-foreground"
            }`}
          >
            {STATUS_LABEL[dimension.status]}
          </span>
        </div>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{dimension.summary}</p>
      </div>
      {dimension.href ? <CaretRightIcon size={14} className="mt-1.5 shrink-0 text-muted-foreground/50" aria-hidden /> : null}
    </>
  )

  return (
    <li>
      {dimension.href ? (
        <Link
          href={dimension.href}
          className="flex items-start gap-3 px-4 py-3 transition-colors duration-100 hover:bg-muted/30 active:bg-muted/60"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3">{body}</div>
      )}
    </li>
  )
}

export function AdminTenantHealthOverview({
  overview,
  children,
}: {
  overview: TenantHealthOverview
  /** Rendered right under the title (e.g. the active-alerts row). */
  children?: React.ReactNode
}) {
  const problemVenues = overview.venues.filter((venue) => needsAttention(venue.status)).length
  const venues = [...overview.venues].sort(
    (a, b) => Number(needsAttention(b.status)) - Number(needsAttention(a.status)) || a.venueName.localeCompare(b.venueName),
  )

  return (
    <div className="space-y-8">
      <LargeTitle
        title={overview.status === "ok" ? "All systems healthy" : STATUS_LABEL[overview.status]}
        subtitle={[
          `${overview.venues.length} venue${overview.venues.length === 1 ? "" : "s"}`,
          problemVenues > 0 ? `${problemVenues} need${problemVenues === 1 ? "s" : ""} attention` : null,
          `checked ${checkedFormat.format(new Date(overview.generatedAt))}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      {children}

      {overview.tenantDimensions.length > 0 ? (
        <GroupedSection header="Platform" footer="Background workers, webhooks and shared infrastructure.">
          {sortDimensions(overview.tenantDimensions).map((dimension) => (
            <DimensionRow key={dimension.key} dimension={dimension} />
          ))}
        </GroupedSection>
      ) : null}

      {venues.length === 0 ? (
        <p className="px-4 text-[15px] text-muted-foreground">No venues are set up yet.</p>
      ) : (
        venues.map((venue) => <AdminVenueHealthCard key={venue.venueId} venue={venue} />)
      )}
    </div>
  )
}

export function AdminVenueHealthCard({ venue }: { venue: VenueHealthSnapshot }) {
  return (
    <section>
      <SectionHeader
        accessory={
          <Link href={`/admin/venues/${venue.venueId}`} className="text-[13px] text-primary normal-case">
            Venue details
          </Link>
        }
      >
        {venue.venueName} · {STATUS_LABEL[venue.status]}
      </SectionHeader>
      <GroupedList>
        {sortDimensions(venue.dimensions).map((dimension) => (
          <DimensionRow key={dimension.key} dimension={dimension} />
        ))}
      </GroupedList>
    </section>
  )
}

/** Compact version used on a venue's own page. */
export function AdminVenueHealthStrip({ venue }: { venue: VenueHealthSnapshot }) {
  return (
    <section>
      <SectionHeader
        accessory={
          <Link href="/admin/health" className="text-[13px] text-primary normal-case">
            All health
          </Link>
        }
      >
        Health · {STATUS_LABEL[venue.status]}
      </SectionHeader>
      <GroupedList>
        {sortDimensions(venue.dimensions).map((dimension) => (
          <DimensionRow key={dimension.key} dimension={dimension} />
        ))}
      </GroupedList>
    </section>
  )
}
