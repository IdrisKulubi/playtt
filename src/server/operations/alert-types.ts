import type { HealthDimensionKey, HealthStatus } from "./health-status.ts"

export type AlertSeverity = "critical" | "warning" | "info"

export type AlertScope = "tenant" | "venue"

export interface AlertCatalogEntry {
  code: string
  title: string
  scope: AlertScope
  healthDimensionKey: HealthDimensionKey
  matchStatuses: HealthStatus[]
  matchSummaryIncludes?: string
  severityByStatus: Partial<Record<HealthStatus, AlertSeverity>>
  owner: string
  escalation: string
  runbookPath: string
  buildHref: (input: { venueId?: string }) => string | null
}

export interface OperationalAlert {
  id: string
  code: string
  title: string
  severity: AlertSeverity
  scope: AlertScope
  summary: string
  venueId: string | null
  venueName: string | null
  owner: string
  escalation: string
  runbookPath: string
  href: string | null
  firedAt: string
}

export interface TenantOperationalAlerts {
  generatedAt: string
  alerts: OperationalAlert[]
  counts: {
    critical: number
    warning: number
    info: number
    total: number
  }
}

export function severityRank(severity: AlertSeverity) {
  switch (severity) {
    case "critical":
      return 3
    case "warning":
      return 2
    case "info":
      return 1
  }
}

export function sortOperationalAlerts(
  alerts: OperationalAlert[],
): OperationalAlert[] {
  return [...alerts].sort((left, right) => {
    const severityDelta = severityRank(right.severity) - severityRank(left.severity)

    if (severityDelta !== 0) {
      return severityDelta
    }

    return left.title.localeCompare(right.title)
  })
}

export function countAlertsBySeverity(alerts: OperationalAlert[]) {
  return alerts.reduce(
    (counts, alert) => {
      counts[alert.severity] += 1
      counts.total += 1
      return counts
    },
    { critical: 0, warning: 0, info: 0, total: 0 },
  )
}
