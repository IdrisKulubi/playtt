import type {
  HealthDimension,
  HealthStatus,
  TenantHealthOverview,
  VenueHealthSnapshot,
  EdgeSourceHealthIssue,
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
    buildHref: ({ venueId, installationId }) =>
      installationId
        ? `/nvr/${installationId}`
        : venueId
          ? `/nvr?venueId=${venueId}`
          : "/nvr",
  },
  {
    code: "venue_edge_update_failed",
    title: "Venue edge update failed",
    scope: "venue",
    healthDimensionKey: "edge",
    matchStatuses: ["degraded", "down"],
    matchSummaryIncludes: "update failed",
    severityByStatus: { degraded: "warning", down: "critical" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/venue-edge-update-rollback.md",
    buildHref: ({ venueId, installationId }) =>
      installationId
        ? `/nvr/${installationId}`
        : venueId
          ? `/nvr?venueId=${venueId}`
          : "/nvr",
  },
  {
    code: "venue_edge_disk_pressure",
    title: "Venue edge disk pressure",
    scope: "venue",
    healthDimensionKey: "edge",
    matchStatuses: ["degraded"],
    matchSummaryIncludes: "disk pressure",
    severityByStatus: { degraded: "warning" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/venue-edge-disk-pressure.md",
    buildHref: ({ venueId, installationId }) =>
      installationId
        ? `/nvr/${installationId}`
        : venueId
          ? `/nvr?venueId=${venueId}`
          : "/nvr",
  },
  {
    code: "venue_edge_camera_unhealthy",
    title: "Venue edge camera unhealthy",
    scope: "venue",
    healthDimensionKey: "edge",
    matchStatuses: ["degraded", "down"],
    matchSummaryIncludes: "camera unhealthy",
    severityByStatus: { degraded: "warning", down: "critical" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/venue-edge-camera-failure.md",
    buildHref: ({ venueId, installationId }) =>
      installationId
        ? `/nvr/${installationId}`
        : venueId
          ? `/nvr?venueId=${venueId}`
          : "/nvr",
  },
  {
    code: "venue_edge_nvr_offline",
    title: "Venue edge NVR offline",
    scope: "venue",
    healthDimensionKey: "edge",
    matchStatuses: ["degraded", "down"],
    matchSummaryIncludes: "nvr offline",
    severityByStatus: { degraded: "warning", down: "critical" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/venue-edge-nvr-replacement.md",
    buildHref: ({ venueId, installationId }) =>
      installationId
        ? `/nvr/${installationId}`
        : venueId
          ? `/nvr?venueId=${venueId}`
          : "/nvr",
  },
  {
    code: "venue_edge_unsupported_version",
    title: "Unsupported VenueEdge version",
    scope: "venue",
    healthDimensionKey: "edge",
    matchStatuses: ["degraded"],
    matchSummaryIncludes: "unsupported version",
    severityByStatus: { degraded: "warning" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/venue-edge-update-rollback.md",
    buildHref: ({ venueId, installationId }) =>
      installationId
        ? `/nvr/${installationId}`
        : venueId
          ? `/nvr?venueId=${venueId}`
          : "/nvr",
  },
  {
    code: "clock_skew",
    title: "Venue edge clock skew",
    scope: "venue",
    healthDimensionKey: "edge",
    matchStatuses: ["degraded"],
    matchSummaryIncludes: "clock skew",
    severityByStatus: { degraded: "warning" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/venue-edge-nvr-replacement.md",
    buildHref: ({ venueId, installationId }) =>
      installationId
        ? `/nvr/${installationId}`
        : venueId
          ? `/nvr?venueId=${venueId}`
          : "/nvr",
  },
  {
    code: "stale_buffer",
    title: "Venue edge stale buffer",
    scope: "venue",
    healthDimensionKey: "edge",
    matchStatuses: ["degraded"],
    matchSummaryIncludes: "stale buffer",
    severityByStatus: { degraded: "warning" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/venue-edge-camera-failure.md",
    buildHref: ({ venueId, installationId }) =>
      installationId
        ? `/nvr/${installationId}`
        : venueId
          ? `/nvr?venueId=${venueId}`
          : "/nvr",
  },
  {
    code: "repeated_failover",
    title: "Venue edge repeated failover",
    scope: "venue",
    healthDimensionKey: "edge",
    matchStatuses: ["degraded"],
    matchSummaryIncludes: "repeated failover",
    severityByStatus: { degraded: "warning" },
    owner: "platform-ops",
    escalation: "On-call operator",
    runbookPath: "docs/operations/runbooks/venue-edge-nvr-replacement.md",
    buildHref: ({ venueId, installationId }) =>
      installationId
        ? `/nvr/${installationId}`
        : venueId
          ? `/nvr?venueId=${venueId}`
          : "/nvr",
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

const SOURCE_SCOPED_ALERT_CODES = new Set([
  "clock_skew",
  "stale_buffer",
  "repeated_failover",
])

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
  sourceIssue?: EdgeSourceHealthIssue
}): OperationalAlert | null {
  const severity = severityForAlert(input.entry, input.dimension.status)

  if (!severity) {
    return null
  }

  const venueId = input.venue?.venueId ?? null
  const venueName = input.venue?.venueName ?? null
  const installationId =
    input.sourceIssue?.installationId ?? input.venue?.edgeInstallationId ?? null
  const recorderId = input.sourceIssue?.recorderId ?? null
  const cameraSourceId = input.sourceIssue?.cameraSourceId ?? null
  const resourceId = input.sourceIssue?.resourceId ?? null
  const scopeKey =
    cameraSourceId ?? recorderId ?? installationId ?? venueId ?? "tenant"

  return {
    id: `${input.entry.code}:${venueId ?? "tenant"}:${scopeKey}`,
    code: input.entry.code,
    title: input.venue
      ? `${input.entry.title} · ${input.venue.venueName}`
      : input.entry.title,
    severity,
    scope: input.entry.scope,
    summary: input.sourceIssue?.summary ?? input.dimension.summary,
    venueId,
    venueName,
    installationId,
    recorderId,
    cameraSourceId,
    resourceId,
    owner: input.entry.owner,
    escalation: input.entry.escalation,
    runbookPath: input.entry.runbookPath,
    href: input.entry.buildHref({
      venueId: venueId ?? undefined,
      installationId: installationId ?? undefined,
    }),
    firedAt: input.firedAt,
  }
}

function buildSourceScopedAlerts(input: {
  venue: VenueHealthSnapshot
  firedAt: string
}): OperationalAlert[] {
  const alerts: OperationalAlert[] = []
  const edgeDimension = input.venue.dimensions.find((item) => item.key === "edge")

  if (!edgeDimension) {
    return alerts
  }

  for (const issue of input.venue.edgeSourceIssues ?? []) {
    const entry = ALERT_CATALOG.find((item) => item.code === issue.code)

    if (!entry || !matchesCatalogEntry(entry, edgeDimension)) {
      continue
    }

    const alert = buildAlert({
      entry,
      dimension: edgeDimension,
      firedAt: input.firedAt,
      venue: input.venue,
      sourceIssue: issue,
    })

    if (alert) {
      alerts.push(alert)
    }
  }

  return alerts
}

export function deriveOperationalAlerts(
  overview: TenantHealthOverview,
): OperationalAlert[] {
  const alerts: OperationalAlert[] = []

  for (const venue of overview.venues) {
    for (const entry of ALERT_CATALOG.filter((item) => item.scope === "venue")) {
      if (SOURCE_SCOPED_ALERT_CODES.has(entry.code)) {
        continue
      }

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

    alerts.push(
      ...buildSourceScopedAlerts({
        venue,
        firedAt: overview.generatedAt,
      }),
    )
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
