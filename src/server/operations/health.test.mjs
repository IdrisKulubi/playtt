import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import {
  evaluateCommandDimension,
  evaluateDeviceDimension,
  evaluateEdgeDimension,
  evaluateInfrastructureProbe,
  evaluateReplayDimension,
  evaluateSessionDimension,
  evaluateWorkerDimension,
  rollupHealthStatus,
} from "./health-status.ts"

const operationsRoot = join(import.meta.dirname)
const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("rollupHealthStatus ignores not_configured and picks the worst active status", () => {
  assert.equal(rollupHealthStatus("ok", "not_configured"), "ok")
  assert.equal(rollupHealthStatus("ok", "degraded"), "degraded")
  assert.equal(rollupHealthStatus("degraded", "down"), "down")
  assert.equal(rollupHealthStatus("not_configured", "not_configured"), "not_configured")
})

test("device health evaluation covers empty, degraded, down, and ok states", () => {
  assert.deepEqual(evaluateDeviceDimension([]), {
    status: "not_configured",
    count: 0,
    summary: "No devices enrolled",
  })

  assert.equal(evaluateDeviceDimension(["offline", "offline"]).status, "down")
  assert.equal(
    evaluateDeviceDimension(["online", "offline"]).status,
    "degraded",
  )
  assert.equal(evaluateDeviceDimension(["online", "online"]).status, "ok")
})

test("edge health evaluation respects offline and queue pressure", () => {
  assert.equal(evaluateEdgeDimension(null).status, "not_configured")
  assert.equal(
    evaluateEdgeDimension({ health: "offline" }).status,
    "down",
  )
  assert.equal(
    evaluateEdgeDimension({
      health: "online",
      replayQueueDepth: 4,
      maxConcurrentReplays: 4,
    }).status,
    "degraded",
  )
  assert.equal(
    evaluateEdgeDimension({ health: "online" }).status,
    "ok",
  )
})

test("session and replay evaluators escalate stuck or failed work", () => {
  assert.equal(evaluateSessionDimension(0).status, "ok")
  assert.equal(evaluateSessionDimension(1).status, "degraded")
  assert.equal(evaluateSessionDimension(3).status, "down")

  assert.equal(evaluateReplayDimension(1, 0).status, "down")
  assert.equal(evaluateReplayDimension(0, 6).status, "degraded")
  assert.equal(evaluateReplayDimension(0, 1).status, "ok")
})

test("worker health evaluation treats dead letters as down", () => {
  assert.equal(
    evaluateWorkerDimension({
      inboxBacklog: {},
      outboxBacklog: {},
      deadLetterInbox: 1,
      deadLetterOutbox: 0,
    }).status,
    "down",
  )

  assert.equal(
    evaluateWorkerDimension({
      inboxBacklog: { failed: 2 },
      outboxBacklog: {},
      deadLetterInbox: 0,
      deadLetterOutbox: 0,
    }).status,
    "degraded",
  )
})

test("command and infrastructure evaluators escalate failed work and probe outages", () => {
  assert.equal(evaluateCommandDimension(0).status, "ok")
  assert.equal(evaluateCommandDimension(1).status, "degraded")
  assert.equal(evaluateCommandDimension(3).status, "down")

  assert.equal(
    evaluateInfrastructureProbe({
      configured: false,
      ok: false,
      summary: "REDIS_URL not configured",
    }).status,
    "not_configured",
  )
  assert.equal(
    evaluateInfrastructureProbe({
      configured: true,
      ok: false,
      summary: "Redis probe failed",
    }).status,
    "down",
  )
  assert.equal(
    evaluateInfrastructureProbe({
      configured: true,
      ok: true,
      summary: "Database reachable (12ms)",
    }).status,
    "ok",
  )
})

test("health repository scopes reads by tenant and venue", () => {
  const source = readFileSync(
    join(operationsRoot, "health-repository.ts"),
    "utf8",
  )

  assert.match(source, /eq\(devices\.tenantId, tenantId\)/)
  assert.match(source, /eq\(playSessions\.tenantId, tenantId\)/)
  assert.match(source, /eq\(replayRequests\.tenantId, tenantId\)/)
  assert.match(source, /eq\(deviceCommands\.status, "failed"\)/)
  assert.match(source, /accessPoints\.tenantId/)
  assert.match(source, /accessCredentials\.tenantId/)
  assert.match(source, /inArray\(devices\.locationId, venueIds\)/)
  assert.match(source, /countTenantDeadLetters\(context\)/)
})

test("health service authorizes venue.read and exposes admin health routes", () => {
  const service = readFileSync(
    join(operationsRoot, "health-service.ts"),
    "utf8",
  )
  const page = readFileSync(
    join(repoRoot, "src", "app", "admin", "health", "page.tsx"),
    "utf8",
  )
  const sidebar = readFileSync(
    join(repoRoot, "src", "components", "admin", "admin-sidebar.tsx"),
    "utf8",
  )
  const venuePage = readFileSync(
    join(repoRoot, "src", "app", "admin", "venues", "[id]", "page.tsx"),
    "utf8",
  )

  assert.match(service, /authorize\(context, "venue\.read"\)/)
  assert.match(service, /probeInfrastructure/)
  assert.match(service, /evaluateCommandDimension/)
  assert.match(service, /evaluateInfrastructureProbe/)
  assert.match(page, /getTenantHealthOverview/)
  assert.match(sidebar, /\/admin\/health/)
  assert.match(venuePage, /getVenueHealthSnapshot/)
  assert.match(venuePage, /AdminVenueHealthStrip/)
})
