import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { parseEdgeConfigV2 } from "../src/cloud/config-v2.ts"
import {
  checksumEdgeConfigSnapshot,
  formatEdgeConfigChecksum,
} from "../src/cloud/config-v2-checksum.ts"
import { redactStringSecrets } from "../src/health/metrics.ts"
import {
  buildSelectionAckResult,
  selectCapturePlan,
} from "../src/selection/select-source.ts"

const fixturesRoot = join(import.meta.dirname, "..", "fixtures")

function loadFixture(name) {
  return JSON.parse(readFileSync(join(fixturesRoot, name), "utf8"))
}

function topologyFromFixture(fixture) {
  return {
    resources: fixture.resources,
    recorders: fixture.recorders,
    sources: fixture.sources,
    resourcePolicies: fixture.resourcePolicies,
  }
}

function withValidChecksum(fixture) {
  const digest = checksumEdgeConfigSnapshot(topologyFromFixture(fixture))
  return {
    ...fixture,
    configRevision: {
      ...fixture.configRevision,
      checksum: formatEdgeConfigChecksum(digest),
    },
  }
}

function healthLookup(overrides = {}) {
  return {
    getStatus(sourceId) {
      return overrides[sourceId]?.status ?? null
    },
    getReasonCode(sourceId) {
      return overrides[sourceId]?.reasonCode ?? null
    },
  }
}

const TABLE_1 = "60000000-0000-4000-8000-000000000001"
const TABLE_2 = "60000000-0000-4000-8000-000000000002"
const SOURCE_NORTH = "80000000-0000-4000-8000-000000000001"
const SOURCE_SOUTH_BACKUP = "80000000-0000-4000-8000-000000000002"
const SOURCE_TABLE_2 = "80000000-0000-4000-8000-000000000003"

test("primary healthy selects north buffer first", () => {
  const config = parseEdgeConfigV2(
    withValidChecksum(loadFixture("edge-v2-three-nvr.json")),
  )

  const plan = selectCapturePlan({
    config,
    resourceId: TABLE_1,
    health: healthLookup(),
  })

  assert.equal(plan.selected?.sourceId, SOURCE_NORTH)
  assert.equal(plan.selected?.captureMode, "edge_buffer")
  assert.equal(plan.selected?.selectionReason, "automatic_priority")
  assert.equal(plan.terminalReason, null)

  const pending = plan.attempts.filter((attempt) => attempt.status === "pending")
  assert.ok(pending.length >= 1)
  assert.equal(pending[0].sourceId, SOURCE_NORTH)
})

test("unhealthy primary skips to south nvr playback", () => {
  const config = parseEdgeConfigV2(
    withValidChecksum(loadFixture("edge-v2-three-nvr.json")),
  )

  const plan = selectCapturePlan({
    config,
    resourceId: TABLE_1,
    health: healthLookup({
      [SOURCE_NORTH]: { status: "unhealthy", reasonCode: "nvr_unreachable" },
    }),
  })

  const north = plan.attempts.find((attempt) => attempt.sourceId === SOURCE_NORTH)
  const south = plan.attempts.find(
    (attempt) =>
      attempt.sourceId === SOURCE_SOUTH_BACKUP &&
      attempt.captureMode === "nvr_playback",
  )

  assert.equal(north?.status, "skipped")
  assert.equal(south?.status, "pending")
  assert.equal(plan.selected?.sourceId, SOURCE_SOUTH_BACKUP)
  assert.equal(plan.selected?.captureMode, "nvr_playback")
  assert.equal(plan.selected?.selectionReason, "failover")
})

test("cross-nvr failover selects secondary when primary is unhealthy", () => {
  const config = parseEdgeConfigV2(
    withValidChecksum(loadFixture("edge-v2-cross-nvr-failover.json")),
  )

  const plan = selectCapturePlan({
    config,
    resourceId: TABLE_1,
    health: healthLookup({
      [SOURCE_NORTH]: { status: "unhealthy", reasonCode: "probe_failed" },
    }),
  })

  assert.equal(plan.selected?.sourceId, SOURCE_SOUTH_BACKUP)
  assert.equal(plan.selected?.captureMode, "nvr_playback")
  assert.equal(plan.terminalReason, null)
})

test("disabled source is never selected", () => {
  const config = parseEdgeConfigV2(
    withValidChecksum(loadFixture("edge-v2-three-nvr.json")),
  )

  const plan = selectCapturePlan({
    config,
    resourceId: TABLE_1,
    health: healthLookup({
      [SOURCE_NORTH]: { status: "unhealthy", reasonCode: "probe_failed" },
      [SOURCE_SOUTH_BACKUP]: {
        status: "disabled",
        reasonCode: "source_disabled",
      },
    }),
  })

  const south = plan.attempts.find(
    (attempt) => attempt.sourceId === SOURCE_SOUTH_BACKUP,
  )

  assert.equal(south?.status, "skipped")
  assert.equal(south?.reasonCode, "source_disabled")
  assert.equal(plan.selected, null)
  assert.equal(plan.terminalReason, "no_healthy_source")
})

test("manual pin uses only the pinned source modes", () => {
  const config = parseEdgeConfigV2(
    withValidChecksum(loadFixture("edge-v2-manual-override.json")),
  )

  const plan = selectCapturePlan({
    config,
    resourceId: TABLE_1,
    health: healthLookup(),
  })

  assert.equal(plan.attempts.length, 1)
  assert.equal(plan.selected?.sourceId, SOURCE_SOUTH_BACKUP)
  assert.equal(plan.selected?.captureMode, "nvr_playback")
  assert.equal(plan.selected?.selectionReason, "manual_pin")
})

test("unhealthy manual pin yields no healthy source without failover", () => {
  const config = parseEdgeConfigV2(
    withValidChecksum(loadFixture("edge-v2-manual-override.json")),
  )

  const plan = selectCapturePlan({
    config,
    resourceId: TABLE_1,
    health: healthLookup({
      [SOURCE_SOUTH_BACKUP]: {
        status: "unhealthy",
        reasonCode: "source_auth_failed",
      },
    }),
  })

  assert.equal(plan.selected, null)
  assert.equal(plan.terminalReason, "no_healthy_source")
  assert.equal(plan.attempts[0]?.sourceId, SOURCE_SOUTH_BACKUP)
  assert.equal(plan.attempts[0]?.status, "skipped")

  const primaryAttempt = plan.attempts.find(
    (attempt) => attempt.sourceId === SOURCE_NORTH,
  )
  assert.equal(primaryAttempt, undefined)
})

test("all candidates ineligible yields skipped trail", () => {
  const config = parseEdgeConfigV2(
    withValidChecksum(loadFixture("edge-v2-cross-nvr-failover.json")),
  )

  const plan = selectCapturePlan({
    config,
    resourceId: TABLE_1,
    health: healthLookup({
      [SOURCE_NORTH]: { status: "unhealthy", reasonCode: "probe_failed" },
      [SOURCE_SOUTH_BACKUP]: {
        status: "unhealthy",
        reasonCode: "probe_failed",
      },
    }),
  })

  assert.equal(plan.selected, null)
  assert.equal(plan.terminalReason, "no_healthy_source")
  assert.ok(plan.attempts.every((attempt) => attempt.status === "skipped"))
})

test("table 1 failure does not change table 2 selection", () => {
  const config = parseEdgeConfigV2(
    withValidChecksum(loadFixture("edge-v2-three-nvr.json")),
  )

  const table1 = selectCapturePlan({
    config,
    resourceId: TABLE_1,
    health: healthLookup({
      [SOURCE_NORTH]: { status: "unhealthy", reasonCode: "probe_failed" },
    }),
  })

  const table2 = selectCapturePlan({
    config,
    resourceId: TABLE_2,
    health: healthLookup({
      [SOURCE_NORTH]: { status: "unhealthy", reasonCode: "probe_failed" },
    }),
  })

  assert.notEqual(table1.selected?.sourceId, SOURCE_TABLE_2)
  assert.equal(table2.selected?.sourceId, SOURCE_TABLE_2)
})

test("locked selection ignores healthier higher-priority source", () => {
  const config = parseEdgeConfigV2(
    withValidChecksum(loadFixture("edge-v2-three-nvr.json")),
  )

  const plan = selectCapturePlan({
    config,
    resourceId: TABLE_1,
    health: healthLookup(),
    lockedSelection: {
      sourceId: SOURCE_SOUTH_BACKUP,
      captureMode: "nvr_playback",
    },
  })

  assert.equal(plan.attempts.length, 1)
  assert.equal(plan.selected?.sourceId, SOURCE_SOUTH_BACKUP)
  assert.equal(plan.selected?.selectionReason, "locked_in_progress")
})

test("selection ack payload contains no rtsp userinfo", () => {
  const ack = buildSelectionAckResult({
    plan: {
      attempts: [],
      selected: {
        sourceId: SOURCE_NORTH,
        recorderId: "70000000-0000-4000-8000-000000000001",
        captureMode: "edge_buffer",
        selectionReason: "automatic_priority",
      },
      terminalReason: null,
      configRevisionId: "55555555-5555-4555-8555-555555555555",
    },
    attempts: [
      {
        ordinal: 1,
        sourceId: SOURCE_NORTH,
        captureMode: "edge_buffer",
        status: "succeeded",
        reasonCode: null,
      },
    ],
  })

  const serialized = JSON.stringify(ack)
  const redacted = redactStringSecrets(
    `rtsp://user:secret@camera.local/stream ${serialized}`,
  )

  assert.ok(!redacted.includes("user:secret"))
  assert.ok(!serialized.includes("rtsp://"))
})
