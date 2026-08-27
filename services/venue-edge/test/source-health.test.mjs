import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { mkdtemp } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"

import { parseEdgeConfigV2 } from "../src/cloud/config-v2.ts"
import {
  checksumEdgeConfigSnapshot,
  formatEdgeConfigChecksum,
} from "../src/cloud/config-v2-checksum.ts"
import { SourceHealthEngine } from "../src/health/engine.ts"
import {
  applyHealthObservation,
  resolveThresholdsForSource,
} from "../src/health/state-machine.ts"
import { redactStringSecrets } from "../src/health/metrics.ts"
import { EdgeRepositories } from "../src/local-storage/repositories.ts"
import { initDatabase } from "../src/state/sqlite.ts"

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

const THRESHOLDS = {
  failureThreshold: 3,
  cooldownSeconds: 60,
  healthyThreshold: 2,
  autoFailback: true,
}

test("three probe failures become unhealthy with cooldown then recover", () => {
  let row = null
  const baseTime = Date.parse("2026-08-27T10:00:00.000Z")

  for (let index = 0; index < 3; index += 1) {
    row = applyHealthObservation(
      row,
      {
        kind: "soft_failure",
        reasonCode: "probe_failed",
        observedAt: new Date(baseTime + index * 1000).toISOString(),
      },
      THRESHOLDS,
      {
        scope: "source",
        recorderId: "rec-1",
        sourceId: "src-1",
      }
    )
  }

  assert.equal(row?.status, "unhealthy")
  assert.ok(row?.cooldownUntil)

  const afterCooldown = new Date(
    Date.parse(row.cooldownUntil) + 1000
  ).toISOString()

  row = applyHealthObservation(
    row,
    {
      kind: "success",
      reasonCode: "probe_failed",
      observedAt: afterCooldown,
    },
    THRESHOLDS,
    {
      scope: "source",
      recorderId: "rec-1",
      sourceId: "src-1",
    }
  )

  row = applyHealthObservation(
    row,
    {
      kind: "success",
      reasonCode: "probe_failed",
      observedAt: new Date(Date.parse(afterCooldown) + 1000).toISOString(),
    },
    THRESHOLDS,
    {
      scope: "source",
      recorderId: "rec-1",
      sourceId: "src-1",
    }
  )

  assert.equal(row?.status, "healthy")
})

test("source_auth_failed is a hard failure", () => {
  const row = applyHealthObservation(
    null,
    {
      kind: "hard_failure",
      reasonCode: "source_auth_failed",
      observedAt: "2026-08-27T10:00:00.000Z",
    },
    THRESHOLDS,
    {
      scope: "source",
      recorderId: "rec-1",
      sourceId: "src-1",
    }
  )

  assert.equal(row.status, "unhealthy")
  assert.equal(row.reasonCode, "source_auth_failed")
  assert.equal(row.consecutiveFailures, 3)
})

test("disabled source is marked disabled without failure counting", () => {
  const row = applyHealthObservation(
    null,
    {
      kind: "soft_failure",
      reasonCode: "source_disabled",
      observedAt: "2026-08-27T10:00:00.000Z",
    },
    THRESHOLDS,
    {
      scope: "source",
      recorderId: "rec-1",
      sourceId: "src-1",
      forceDisabled: true,
      disabledReasonCode: "source_disabled",
    }
  )

  assert.equal(row.status, "disabled")
  assert.equal(row.reasonCode, "source_disabled")
})

test("recorder unreachable fans out only to that NVR cameras", async () => {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-health-"))
  const database = initDatabase(join(dir, "venue-edge.sqlite"))
  const repositories = new EdgeRepositories(database.db)
  const fixture = withValidChecksum(loadFixture("edge-v2-three-nvr.json"))
  const config = parseEdgeConfigV2(fixture)

  const engine = new SourceHealthEngine(repositories, () => config)

  engine.recordRecorderObservation("70000000-0000-4000-8000-000000000001", {
    kind: "hard_failure",
    reasonCode: "nvr_unreachable",
    observedAt: "2026-08-27T10:00:00.000Z",
  })

  const northSource = engine.getSourceHealth(
    "80000000-0000-4000-8000-000000000001"
  )
  const southSource = engine.getSourceHealth(
    "80000000-0000-4000-8000-000000000003"
  )

  assert.equal(northSource?.status, "unhealthy")
  assert.equal(northSource?.reasonCode, "nvr_unreachable")
  assert.notEqual(southSource?.status, "unhealthy")

  database.close()
})

test("replay outcome is attributed to the source that was actually selected", async () => {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-health-"))
  const database = initDatabase(join(dir, "venue-edge.sqlite"))
  const repositories = new EdgeRepositories(database.db)
  const fixture = withValidChecksum(loadFixture("edge-v2-three-nvr.json"))
  const config = parseEdgeConfigV2(fixture)

  const engine = new SourceHealthEngine(repositories, () => config)

  engine.recordReplayOutcome(
    "80000000-0000-4000-8000-000000000003",
    "extraction_failed",
    false
  )

  const table1 = engine.getSourceHealth("80000000-0000-4000-8000-000000000001")
  const table2 = engine.getSourceHealth("80000000-0000-4000-8000-000000000003")

  assert.equal(table1, null)
  assert.equal(table2?.status, "degraded")

  database.close()
})

test("buffer stale observation marks source degraded", () => {
  const row = applyHealthObservation(
    null,
    {
      kind: "degraded",
      reasonCode: "buffer_stale",
      observedAt: "2026-08-27T10:00:00.000Z",
    },
    THRESHOLDS,
    {
      scope: "source",
      recorderId: "rec-1",
      sourceId: "src-1",
    }
  )

  assert.equal(row.status, "degraded")
  assert.equal(row.reasonCode, "buffer_stale")
})

test("health details redact rtsp userinfo", () => {
  const redacted = redactStringSecrets("rtsp://user:secret@camera.local/stream")
  assert.ok(!redacted.includes("user:secret"))
  assert.ok(!redacted.includes("secret@"))
})

test("resolveThresholdsForSource uses strictest policy", () => {
  const fixture = withValidChecksum(loadFixture("edge-v2-three-nvr.json"))
  const config = parseEdgeConfigV2(fixture)

  const thresholds = resolveThresholdsForSource(
    config,
    "80000000-0000-4000-8000-000000000001"
  )

  assert.equal(thresholds.failureThreshold, 3)
  assert.equal(thresholds.cooldownSeconds, 30)
  assert.equal(thresholds.healthyThreshold, 2)
})
