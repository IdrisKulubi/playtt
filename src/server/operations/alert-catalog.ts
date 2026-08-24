import type {
  HealthDimension,
  HealthStatus,
  TenantHealthOverview,
  VenueHealthSnapshot,
} from "./health-status.ts"
import {
  type AlertCatalogEntry,
  type OperationalAlert,
  sortOperationalAlerts,
} from "./alert-types.ts"

export const ALERT_CATALOG: AlertCatalogEntry[] = [
  {
    code: "device_offline",
    title: "Device offline",
    scope: "venue",
    healthDimensionKey: "devices",
    matchStatuses: ["degraded", "down"],
    severityByStatus: { degraded: "warning", down: "critical" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/device-offline.md",
    buildHref: ({ venueId }) =>
      venueId ? `/admin/devices?venueId=${venueId}` : "/admin/devices",
  },
  {
    code: "venue_edge_offline",
    title: "Venue edge offline",
    scope: "venue",
    healthDimensionKey: "edge",
    matchStatuses: ["degraded", "down"],
    severityByStatus: { degraded: "warning", down: "critical" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/venue-edge-offline.md",
    buildHref: ({ venueId }) =>
      venueId ? `/admin/venues/${venueId}` : "/admin/venues",
  },
  {
    code: "stuck_session",
    title: "Stuck play session",
    scope: "venue",
    healthDimensionKey: "sessions",
    matchStatuses: ["degraded", "down"],
    severityByStatus: { degraded: "warning", down: "critical" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/stuck-session.md",
    buildHref: () => "/admin/bookings",
  },
  {
    code: "replay_failed",
    title: "Replay failure",
    scope: "venue",
    healthDimensionKey: "replay",
    matchStatuses: ["down"],
    severityByStatus: { down: "critical" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/replay-failure.md",
    buildHref: ({ venueId }) =>
      venueId ? `/admin/venues/${venueId}` : "/admin/venues",
  },
  {
    code: "replay_backlog",
    title: "Replay backlog",
    scope: "venue",
    healthDimensionKey: "replay",
    matchStatuses: ["degraded"],
    severityByStatus: { degraded: "warning" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/replay-backlog.md",
    buildHref: ({ venueId }) =>
      venueId ? `/admin/venues/${venueId}` : "/admin/venues",
  },
  {
    code: "worker_dead_letter",
    title: "Worker dead letter",
    scope: "tenant",
    healthDimensionKey: "workers",
    matchStatuses: ["down"],
    severityByStatus: { down: "critical" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/worker-dead-letter.md",
    buildHref: () => "/admin/durable-work",
  },
  {
    code: "webhook_failure",
    title: "Webhook processing failure",
    scope: "tenant",
    healthDimensionKey: "workers",
    matchStatuses: ["degraded"],
    matchSummaryIncludes: "failed webhook",
    severityByStatus: { degraded: "warning" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/webhook-failure.md",
    buildHref: () => "/admin/durable-work",
  },
  {
    code: "worker_backlog",
    title: "Worker backlog",
    scope: "tenant",
    healthDimensionKey: "workers",
    matchStatuses: ["degraded"],
    matchSummaryIncludes: "backlog",
    severityByStatus: { degraded: "warning" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/worker-backlog.md",
    buildHref: () => "/admin/durable-work",
  },
  {
    code: "command_failure",
    title: "Device command failure",
    scope: "venue",
    healthDimensionKey: "commands",
    matchStatuses: ["degraded", "down"],
    severityByStatus: { degraded: "warning", down: "critical" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/command-failure.md",
    buildHref: ({ venueId }) =>
      venueId ? `/admin/devices?venueId=${venueId}` : "/admin/devices",
  },
  {
    code: "database_unreachable",
    title: "Database unreachable",
    scope: "tenant",
    healthDimensionKey: "database",
    matchStatuses: ["down"],
    severityByStatus: { down: "critical" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/infrastructure-db.md",
    buildHref: () => "/admin/health",
  },
  {
    code: "redis_unreachable",
    title: "Redis unreachable",
    scope: "tenant",
    healthDimensionKey: "redis",
    matchStatuses: ["down"],
    severityByStatus: { down: "critical" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/infrastructure-redis.md",
    buildHref: () => "/admin/health",
  },
  {
    code: "r2_unreachable",
    title: "R2 storage unreachable",
    scope: "tenant",
    healthDimensionKey: "storage",
    matchStatuses: ["down"],
    severityByStatus: { down: "critical" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/infrastructure-r2.md",
    buildHref: () => "/admin/health",
  },
  {
    code: "access_credential_failed",
    title: "Access credential failure",
    scope: "venue",
    healthDimensionKey: "access",
    matchStatuses: ["degraded", "down"],
    severityByStatus: { degraded: "warning", down: "critical" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/ttlock-access.md",
    buildHref: () => "/admin/bookings",
  },
  {
    code: "venue_network_offline",
    title: "Venue network offline",
    scope: "venue",
    healthDimensionKey: "network",
    matchStatuses: ["degraded", "down"],
    severityByStatus: { degraded: "warning", down: "critical" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/venue-network.md",
    buildHref: ({ venueId }) =>
      venueId ? `/admin/venues/${venueId}` : "/admin/venues",
  },
]

export const ALERT_CATALOG_STUBS = [] as const

function matchesCatalogEntry(
  entry: AlertCatalogEntry,
  dimension: HealthDimension,
): boolean {
  if (dimension.key !== entry.healthDimensionKey) {
    return false
  }

  if (!entry.matchStatuses.includes(dimension.status)) {
    return false
  }

  if (
    entry.matchSummaryIncludes &&
    !dimension.summary.toLowerCase().includes(entry.matchSummaryIncludes)
  ) {
    return false
  }

  return true
}

function severityForAlert(
  entry: AlertCatalogEntry,
  status: HealthStatus,
): OperationalAlert["severity"] | null {
  return entry.severityByStatus[status] ?? null
}

function buildAlert(input: {
  entry: AlertCatalogEntry
  dimension: HealthDimension
  firedAt: string
  venue?: VenueHealthSnapshot
}): OperationalAlert | null {
  const severity = severityForAlert(input.entry, input.dimension.status)

  if (!severity) {
    return null
  }

  const venueId = input.venue?.venueId ?? null
  const venueName = input.venue?.venueName ?? null

  return {
    id: `${input.entry.code}:${venueId ?? "tenant"}`,
    code: input.entry.code,
    title: input.venue
      ? `${input.entry.title} · ${input.venue.venueName}`
      : input.entry.title,
    severity,
    scope: input.entry.scope,
    summary: input.dimension.summary,
    venueId,
    venueName,
    owner: input.entry.owner,
    escalation: input.entry.escalation,
    runbookPath: input.entry.runbookPath,
    href: input.entry.buildHref({ venueId: venueId ?? undefined }),
    firedAt: input.firedAt,
  }
}

export function deriveOperationalAlerts(
  overview: TenantHealthOverview,
): OperationalAlert[] {
  const alerts: OperationalAlert[] = []

  for (const venue of overview.venues) {
    for (const entry of ALERT_CATALOG.filter((item) => item.scope === "venue")) {
      const dimension = venue.dimensions.find(
        (item) => item.key === entry.healthDimensionKey,
      )

      if (!dimension || !matchesCatalogEntry(entry, dimension)) {
        continue
      }

      const alert = buildAlert({
        entry,
        dimension,
        firedAt: overview.generatedAt,
        venue,
      })

      if (alert) {
        alerts.push(alert)
      }
    }
  }

  for (const entry of ALERT_CATALOG.filter((item) => item.scope === "tenant")) {
    const dimension = overview.tenantDimensions.find(
      (item) => item.key === entry.healthDimensionKey,
    )

    if (!dimension || !matchesCatalogEntry(entry, dimension)) {
      continue
    }

    const alert = buildAlert({
      entry,
      dimension,
      firedAt: overview.generatedAt,
    })

    if (alert) {
      alerts.push(alert)
    }
  }

  return sortOperationalAlerts(alerts)
}
