import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import { ALERT_CATALOG, deriveOperationalAlerts } from "./alert-catalog.ts"
import {
  countAlertsBySeverity,
  sortOperationalAlerts,
} from "./alert-types.ts"
import { extractEdgeSourceHealthIssues } from "./health-status.ts"

const operationsRoot = join(import.meta.dirname)
const repoRoot = join(import.meta.dirname, "..", "..", "..")

function sampleOverview(overrides = {}) {
  return {
    status: "degraded",
    generatedAt: "2026-01-01T10:00:00.000Z",
    tenantDimensions: [
      {
        key: "workers",
        label: "Workers",
        status: "down",
        count: 2,
        summary: "2 dead-letter jobs",
        href: "/admin/durable-work",
      },
    ],
    venues: [
      {
        venueId: "venue-1",
        venueName: "Hurlingham",
        status: "degraded",
        dimensions: [
          {
            key: "devices",
            label: "Devices",
            status: "degraded",
            count: 1,
            summary: "1 offline, 0 unknown",
            href: "/admin/devices?venueId=venue-1",
          },
          {
            key: "edge",
            label: "Venue edge",
            status: "ok",
            count: 0,
            summary: "Venue edge online",
            href: "/admin/venues/venue-1",
          },
          {
            key: "sessions",
            label: "Sessions",
            status: "ok",
            count: 0,
            summary: "No stuck sessions",
            href: "/admin/bookings",
          },
          {
            key: "replay",
            label: "Replay",
            status: "ok",
            count: 0,
            summary: "No replay issues",
            href: "/admin/venues/venue-1",
          },
          {
            key: "commands",
            label: "Device commands",
            status: "degraded",
            count: 1,
            summary: "1 failed device command",
            href: "/admin/devices?venueId=venue-1",
          },
          {
            key: "access",
            label: "Access / TTLock",
            status: "not_configured",
            count: 0,
            summary: "TTLock automation ships in Phase 5",
            href: null,
          },
          {
            key: "network",
            label: "Internet / WAN",
            status: "not_configured",
            count: 0,
            summary: "Venue WAN checks ship in P7-04",
            href: null,
          },
        ],
      },
    ],
    ...overrides,
  }
}

test("alert catalog covers implemented venue and tenant health dimensions", () => {
  const venueKeys = new Set(
    ALERT_CATALOG.filter((entry) => entry.scope === "venue").map(
      (entry) => entry.healthDimensionKey,
    ),
  )
  const tenantKeys = new Set(
    ALERT_CATALOG.filter((entry) => entry.scope === "tenant").map(
      (entry) => entry.healthDimensionKey,
    ),
  )

  assert.ok(venueKeys.has("devices"))
  assert.ok(venueKeys.has("edge"))
  assert.ok(venueKeys.has("sessions"))
  assert.ok(venueKeys.has("replay"))
  assert.ok(venueKeys.has("commands"))
  assert.ok(venueKeys.has("access"))
  assert.ok(venueKeys.has("network"))
  assert.equal(tenantKeys.has("workers"), true)
  assert.ok(tenantKeys.has("database"))
  assert.ok(tenantKeys.has("redis"))
  assert.ok(tenantKeys.has("storage"))
  assert.ok(ALERT_CATALOG.some((entry) => entry.code === "clock_skew"))
  assert.ok(ALERT_CATALOG.some((entry) => entry.code === "stale_buffer"))
  assert.ok(ALERT_CATALOG.some((entry) => entry.code === "repeated_failover"))
})

test("deriveOperationalAlerts emits source-scoped edge alerts with installation links", () => {
  const issues = extractEdgeSourceHealthIssues({
    installationId: "installation-1",
    sourceHealth: [
      {
        sourceId: "camera-1",
        recorderId: "recorder-1",
        reasonCode: "clock_skew",
      },
    ],
  })

  const alerts = deriveOperationalAlerts({
    status: "degraded",
    generatedAt: "2026-01-01T10:00:00.000Z",
    tenantDimensions: [],
    venues: [
      {
        venueId: "venue-1",
        venueName: "Hurlingham",
        status: "degraded",
        edgeInstallationId: "installation-1",
        edgeSourceIssues: issues,
        dimensions: [
          {
            key: "edge",
            label: "Venue edge",
            status: "degraded",
            count: 1,
            summary: "Venue edge clock skew (1)",
            href: "/nvr/installation-1",
          },
        ],
      },
    ],
  })

  const clockSkew = alerts.find((alert) => alert.code === "clock_skew")
  assert.ok(clockSkew)
  assert.equal(clockSkew.installationId, "installation-1")
  assert.equal(clockSkew.cameraSourceId, "camera-1")
  assert.equal(clockSkew.recorderId, "recorder-1")
  assert.equal(clockSkew.href, "/nvr/installation-1")
})

test("deriveOperationalAlerts maps degraded and down health to warning and critical", () => {
  const alerts = deriveOperationalAlerts(sampleOverview())

  assert.ok(alerts.some((alert) => alert.code === "device_offline"))
  assert.ok(alerts.some((alert) => alert.code === "worker_dead_letter"))
  assert.ok(alerts.some((alert) => alert.code === "command_failure"))
  assert.equal(
    alerts.find((alert) => alert.code === "device_offline")?.severity,
    "warning",
  )
  assert.equal(
    alerts.find((alert) => alert.code === "worker_dead_letter")?.severity,
    "critical",
  )
})

test("deriveOperationalAlerts ignores not_configured dimensions", () => {
  const alerts = deriveOperationalAlerts(sampleOverview())
  assert.equal(
    alerts.some((alert) => alert.code === "access_credential_failed"),
    false,
  )
})

test("sortOperationalAlerts orders critical before warning", () => {
  const sorted = sortOperationalAlerts([
    {
      id: "warning:tenant",
      code: "worker_backlog",
      title: "Worker backlog",
      severity: "warning",
      scope: "tenant",
      summary: "12 jobs in backlog",
      venueId: null,
      venueName: null,
      installationId: null,
      recorderId: null,
      cameraSourceId: null,
      resourceId: null,
      owner: "platform-ops",
      escalation: "On-call operator",
      runbookPath: "docs/operations/runbooks/worker-backlog.md",
      href: "/admin/durable-work",
      firedAt: "2026-01-01T10:00:00.000Z",
    },
    {
      id: "critical:tenant",
      code: "worker_dead_letter",
      title: "Worker dead letter",
      severity: "critical",
      scope: "tenant",
      summary: "2 dead-letter jobs",
      venueId: null,
      venueName: null,
      installationId: null,
      recorderId: null,
      cameraSourceId: null,
      resourceId: null,
      owner: "platform-ops",
      escalation: "On-call operator",
      runbookPath: "docs/operations/runbooks/worker-dead-letter.md",
      href: "/admin/durable-work",
      firedAt: "2026-01-01T10:00:00.000Z",
    },
  ])

  assert.equal(sorted[0]?.severity, "critical")
})

test("countAlertsBySeverity totals active alerts", () => {
  const counts = countAlertsBySeverity(deriveOperationalAlerts(sampleOverview()))
  assert.equal(counts.total, counts.critical + counts.warning + counts.info)
  assert.ok(counts.total >= 2)
})

test("alerts service authorizes venue.read and admin routes expose alerts UI", () => {
  const service = readFileSync(
    join(operationsRoot, "alerts-service.ts"),
    "utf8",
  )
  const page = readFileSync(
    join(repoRoot, "src", "app", "admin", "alerts", "page.tsx"),
    "utf8",
  )
  const healthPage = readFileSync(
    join(repoRoot, "src", "app", "admin", "health", "page.tsx"),
    "utf8",
  )
  const sidebar = readFileSync(
    join(repoRoot, "src", "components", "admin", "admin-sidebar.tsx"),
    "utf8",
  )

  assert.match(service, /authorize\(context, "venue\.read"\)/)
  assert.match(service, /deriveOperationalAlerts/)
  assert.match(page, /getTenantOperationalAlerts/)
  assert.match(healthPage, /AdminActiveAlertsStrip/)
  assert.match(sidebar, /\/admin\/alerts/)
})
