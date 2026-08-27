import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  mkdtemp,
  mkdir,
  rm,
  writeFile as writeFileAsync,
} from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"

import { parseEdgeConfigV2 } from "../src/cloud/config-v2.ts"
import {
  checksumEdgeConfigSnapshot,
  formatEdgeConfigChecksum,
} from "../src/cloud/config-v2-checksum.ts"
import { listBufferingSourceIds } from "../src/cameras/registry.ts"
import { evaluateBufferStartBudget } from "../src/config/budgets.ts"
import { EdgeConfigV2Manager } from "../src/config/apply-v2.ts"
import { loadEnv } from "../src/config/env.ts"
import { SourceHealthEngine } from "../src/health/engine.ts"
import { EdgeRepositories } from "../src/local-storage/repositories.ts"
import { createLocalStoragePaths } from "../src/local-storage/paths.ts"
import {
  enforceWorkspaceDiskBudget,
  measureWorkspaceBytes,
  pruneReplayWorkspace,
} from "../src/local-storage/prune.ts"
import { ReplayOrchestrator } from "../src/replay/orchestrator.ts"
import { reindexBufferSegmentsFromDisk } from "../src/recovery/reindex-buffers.ts"
import { resumeUnfinishedJobs } from "../src/recovery/resume.ts"
import { selectCapturePlan } from "../src/selection/select-source.ts"
import {
  applySimulatorScenarioToHealth,
  parseSimulatorScenario,
  shouldSimulatedExtractionFail,
} from "../src/simulator/scenario.ts"
import { PROTOCOL_FIXTURE_COMMAND } from "../src/simulator/fixtures.ts"
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

function splitMatrixFixture() {
  const raw = loadFixture("edge-v2-simulator-matrix.json")
  const { simulatorScenario, ...topology } = raw
  return {
    config: parseEdgeConfigV2(withValidChecksum(topology)),
    scenario: parseSimulatorScenario(simulatorScenario),
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

const NVR_NORTH = "70000000-0000-4000-8000-000000000001"
const NVR_SOUTH = "70000000-0000-4000-8000-000000000002"
const SOURCE_PRIMARY = "80000000-0000-4000-8000-000000000001"
const SOURCE_FAILOVER = "80000000-0000-4000-8000-000000000002"
const SOURCE_H265 = "80000000-0000-4000-8000-000000000003"
const TABLE_1 = "60000000-0000-4000-8000-000000000001"
const TABLE_2 = "60000000-0000-4000-8000-000000000002"

test("simulator scenario marks independent NVR failures", async () => {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-sim-health-"))
  const database = initDatabase(join(dir, "venue-edge.sqlite"))
  const repositories = new EdgeRepositories(database.db)
  const { config, scenario } = splitMatrixFixture()

  const engine = new SourceHealthEngine(
    repositories,
    () => config,
    undefined,
    () => scenario
  )

  await engine.tick()

  const northSource = engine.getSourceHealth(SOURCE_PRIMARY)
  const southSource = engine.getSourceHealth(SOURCE_FAILOVER)

  assert.equal(northSource?.status, "unhealthy")
  assert.notEqual(southSource?.status, "unhealthy")

  database.close()
  await rm(dir, { recursive: true, force: true })
})

test("simulator scenario applies codec incompatible observation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-sim-codec-"))
  const database = initDatabase(join(dir, "venue-edge.sqlite"))
  const repositories = new EdgeRepositories(database.db)
  const { config, scenario } = splitMatrixFixture()

  const engine = new SourceHealthEngine(repositories, () => config)
  applySimulatorScenarioToHealth(engine, scenario)

  const h265 = engine.getSourceHealth(SOURCE_H265)
  assert.equal(h265?.status, "unhealthy")
  assert.equal(h265?.reasonCode, "codec_incompatible")

  database.close()
  await rm(dir, { recursive: true, force: true })
})

test("simulated extraction failure enables failover with stable identities", async () => {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-failover-"))
  const env = loadEnv({
    mode: "simulate",
    dataDir: dir,
    cloudBaseUrl: "http://mock.local",
    sqlitePath: join(dir, "venue-edge.sqlite"),
  })

  const progress = []
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url)
    if (parsed.pathname.endsWith("/progress")) {
      progress.push(JSON.parse(String(init?.body)).status)
      return new Response(JSON.stringify({ data: {} }), { status: 200 })
    }
    if (parsed.pathname.endsWith("/ack")) {
      return new Response(JSON.stringify({ data: {} }), { status: 200 })
    }
    if (parsed.pathname.includes("/upload-url")) {
      return new Response(
        JSON.stringify({
          data: {
            uploadGrant: {
              url: "https://r2.example/upload",
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
          },
        }),
        { status: 200 }
      )
    }
    return new Response(JSON.stringify({ data: {} }), { status: 200 })
  }

  const database = initDatabase(env.sqlitePath)
  const repositories = new EdgeRepositories(database.db)
  const paths = createLocalStoragePaths(env)
  const { config, scenario } = splitMatrixFixture()

  const scenarioWithPrimaryFail = {
    sources: [{ sourceId: SOURCE_PRIMARY, failureMode: "extraction_failed" }],
  }

  const healthEngine = new SourceHealthEngine(
    repositories,
    () => config,
    undefined,
    () => scenarioWithPrimaryFail
  )

  const payload = {
    ...PROTOCOL_FIXTURE_COMMAND.payload,
    resourceId: TABLE_1,
    replayRequestId: "replay-failover-001",
    replayId: "replay-id-stable",
    mediaAssetId: "media-stable",
    objectKey: "tenant/demo/replays/stable.mp4",
  }

  const client = new (await import("../src/cloud/client.ts")).EdgeV1Client({
    baseUrl: env.cloudBaseUrl,
    deviceId: "device-1",
    secret: "secret-1",
    fetchImpl,
  })

  const orchestrator = new ReplayOrchestrator({
    env,
    client,
    repositories,
    paths,
    getEdgeConfig: () => null,
    getEdgeConfigV2: () => config,
    healthEngine,
    getSimulatorScenario: () => scenarioWithPrimaryFail,
    fetchImpl,
  })

  repositories.upsertCommand({
    id: "cmd-failover-1",
    kind: "capture_replay",
    payload,
    correlationId: "corr-1",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    attemptCount: 1,
  })

  await orchestrator.processCaptureReplay("cmd-failover-1", payload)

  const attempts = repositories.listCaptureAttempts(payload.replayRequestId)
  const failedPrimary = attempts.find(
    (attempt) => attempt.sourceId === SOURCE_PRIMARY
  )
  const succeeded = attempts.find((attempt) => attempt.status === "succeeded")

  assert.equal(failedPrimary?.status, "failed")
  assert.equal(succeeded?.sourceId, SOURCE_FAILOVER)
  assert.ok(progress.includes("ready"))

  const job = repositories.getReplayJob(payload.replayRequestId)
  assert.equal(job?.lockedSourceId, SOURCE_FAILOVER)
  assert.equal(payload.replayId, "replay-id-stable")
  assert.equal(payload.mediaAssetId, "media-stable")
  assert.equal(payload.objectKey, "tenant/demo/replays/stable.mp4")

  database.close()
  await rm(dir, { recursive: true, force: true })
})

test("reindex restores buffer segments from disk on restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-reindex-"))
  const env = loadEnv({
    mode: "simulate",
    dataDir: dir,
    sqlitePath: join(dir, "venue-edge.sqlite"),
  })
  const database = initDatabase(env.sqlitePath)
  const repositories = new EdgeRepositories(database.db)
  const paths = createLocalStoragePaths(env)
  const config = parseEdgeConfigV2(
    withValidChecksum(loadFixture("edge-v2-three-nvr.json"))
  )
  const sourceId = SOURCE_PRIMARY
  const bufferDir = paths.bufferForCamera(sourceId)
  await mkdir(bufferDir, { recursive: true })
  const segmentPath = join(bufferDir, "segment-000000001.ts")
  await writeFileAsync(segmentPath, Buffer.alloc(2048, 1))

  const indexed = await reindexBufferSegmentsFromDisk({
    repositories,
    paths,
    sourceIds: [sourceId],
  })

  assert.ok(indexed > 0)
  const segments = repositories.listBufferSegmentsForWindow(
    sourceId,
    new Date(0).toISOString(),
    new Date().toISOString()
  )
  assert.ok(segments.length > 0)

  database.close()
  await rm(dir, { recursive: true, force: true })
})

test("resume honors locked source and ignores healthier primary", () => {
  const config = parseEdgeConfigV2(
    withValidChecksum(loadFixture("edge-v2-three-nvr.json"))
  )

  const plan = selectCapturePlan({
    config,
    resourceId: TABLE_1,
    health: healthLookup(),
    lockedSelection: {
      sourceId: SOURCE_FAILOVER,
      captureMode: "nvr_playback",
    },
  })

  assert.equal(plan.attempts.length, 1)
  assert.equal(plan.selected?.sourceId, SOURCE_FAILOVER)
  assert.equal(plan.selected?.selectionReason, "locked_in_progress")
})

test("config rollback keeps LKG candidates after cloud outage", async () => {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-rollback-"))
  const database = initDatabase(join(dir, "venue-edge.sqlite"))
  const repositories = new EdgeRepositories(database.db)
  const client = {
    async getConfigV2() {
      throw new Error("network down")
    },
    async acknowledgeConfigV2Application() {
      return { idempotent: true }
    },
  }

  const manager = new EdgeConfigV2Manager(repositories, client, "boot-1")
  const first = withValidChecksum(loadFixture("edge-v2-one-nvr.json"))
  const second = withValidChecksum({
    ...loadFixture("edge-v2-three-nvr.json"),
    configRevision: {
      ...loadFixture("edge-v2-three-nvr.json").configRevision,
      version: 99,
    },
  })

  await manager.applyValidatedSnapshot(first, { acknowledge: false })
  await manager.applyValidatedSnapshot(second, { acknowledge: false })

  const rolled = manager.rollbackToPreviousOnDisk()
  assert.ok(rolled)
  assert.equal(rolled?.configRevision.version, first.configRevision.version)

  const refresh = await manager.refreshFromCloud()
  assert.equal(refresh.applied, false)
  assert.equal(
    manager.getState().edgeConfigV2?.configRevision.version,
    first.configRevision.version
  )

  database.close()
  await rm(dir, { recursive: true, force: true })
})

test("disk pressure defers buffer supervisor starts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-disk-pressure-"))
  const env = loadEnv({
    dataDir: dir,
    minFreeMemoryBytes: 0,
    maxCpuLoadAverage: 999999,
    reservedFreeDiskBytes: Number.MAX_SAFE_INTEGER,
  })
  const budget = await evaluateBufferStartBudget(env, 0)
  assert.equal(budget.allowed, false)
  assert.equal(budget.reason, "disk_pressure")
  await rm(dir, { recursive: true, force: true })
})

test("workspace pruning bounds pending bytes after failures", async () => {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-prune-"))
  const env = loadEnv({
    mode: "simulate",
    dataDir: dir,
    reservedFreeDiskBytes: 4096,
    sqlitePath: join(dir, "venue-edge.sqlite"),
  })
  const database = initDatabase(env.sqlitePath)
  const repositories = new EdgeRepositories(database.db)
  const paths = createLocalStoragePaths(env)

  for (let index = 0; index < 5; index += 1) {
    const replayId = `replay-stale-${index}`
    const replayDir = paths.pendingForReplay(replayId)
    await mkdir(replayDir, { recursive: true })
    await writeFileAsync(join(replayDir, "clip.mp4"), Buffer.alloc(2048, index))
  }

  const before = await measureWorkspaceBytes(paths)
  assert.ok(before > env.reservedFreeDiskBytes)

  await enforceWorkspaceDiskBudget({
    env,
    paths,
    repositories,
    maxWorkspaceBytes: 2048,
  })

  const after = await measureWorkspaceBytes(paths)
  assert.ok(after <= before)

  await pruneReplayWorkspace(paths, "replay-stale-0")
  database.close()
  await rm(dir, { recursive: true, force: true })
})

test("ten-resource fixture lists ten isolated buffering sources", () => {
  const config = parseEdgeConfigV2(
    withValidChecksum(loadFixture("edge-v2-ten-resource.json"))
  )
  const sourceIds = listBufferingSourceIds(config)

  assert.equal(sourceIds.length, 10)
  assert.equal(new Set(sourceIds).size, 10)

  const planA = selectCapturePlan({
    config,
    resourceId: TABLE_1,
    health: healthLookup({
      [SOURCE_PRIMARY]: { status: "unhealthy", reasonCode: "probe_failed" },
    }),
  })

  const planB = selectCapturePlan({
    config,
    resourceId: TABLE_2,
    health: healthLookup({
      [SOURCE_PRIMARY]: { status: "unhealthy", reasonCode: "probe_failed" },
    }),
  })

  assert.equal(planA.selected, null)
  assert.equal(planB.selected?.sourceId, "80000000-0000-4000-8000-000000000002")
})

test("shouldSimulatedExtractionFail respects scenario overlay", () => {
  const scenario = parseSimulatorScenario({
    sources: [{ sourceId: SOURCE_PRIMARY, failureMode: "extraction_failed" }],
  })

  assert.equal(shouldSimulatedExtractionFail(scenario, SOURCE_PRIMARY), true)
  assert.equal(shouldSimulatedExtractionFail(scenario, SOURCE_FAILOVER), false)
})

test("resume uses the locked config snapshot after the current config removes its source", async () => {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-lock-resume-"))
  const env = loadEnv({
    mode: "simulate",
    dataDir: dir,
    cloudBaseUrl: "http://mock.local",
    sqlitePath: join(dir, "venue-edge.sqlite"),
  })

  const progress = []
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url)
    if (parsed.pathname.endsWith("/progress")) {
      progress.push(JSON.parse(String(init?.body)).status)
      return new Response(JSON.stringify({ data: {} }), { status: 200 })
    }
    if (parsed.pathname.endsWith("/ack")) {
      return new Response(JSON.stringify({ data: {} }), { status: 200 })
    }
    if (parsed.pathname.includes("/upload-url")) {
      return new Response(
        JSON.stringify({
          data: {
            uploadGrant: {
              url: "https://r2.example/upload",
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
          },
        }),
        { status: 200 }
      )
    }
    return new Response(JSON.stringify({ data: {} }), { status: 200 })
  }

  const database = initDatabase(env.sqlitePath)
  const repositories = new EdgeRepositories(database.db)
  const paths = createLocalStoragePaths(env)
  const config = parseEdgeConfigV2(
    withValidChecksum(loadFixture("edge-v2-three-nvr.json"))
  )
  const currentConfig = structuredClone(config)
  currentConfig.sources = currentConfig.sources.filter(
    (source) => source.id !== SOURCE_FAILOVER
  )
  for (const policy of currentConfig.resourcePolicies) {
    policy.candidates = policy.candidates.filter(
      (candidate) => candidate.sourceId !== SOURCE_FAILOVER
    )
  }

  const payload = {
    ...PROTOCOL_FIXTURE_COMMAND.payload,
    resourceId: TABLE_1,
    replayRequestId: "replay-lock-resume",
  }

  repositories.upsertCommand({
    id: "cmd-lock-resume",
    kind: "capture_replay",
    payload,
    correlationId: "corr-lock",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    attemptCount: 1,
  })

  const clipPath = join(dir, "pending", "clip.mp4")
  await mkdir(join(dir, "pending"), { recursive: true })
  await writeFileAsync(clipPath, Buffer.alloc(40, 7))

  repositories.createReplayJob({
    commandId: "cmd-lock-resume",
    payload,
    configSnapshot: config,
    status: "extracting",
  })

  repositories.updateReplayJob(payload.replayRequestId, {
    localClipPath: clipPath,
    lockedSourceId: SOURCE_FAILOVER,
    lockedCaptureMode: "nvr_playback",
  })

  const client = new (await import("../src/cloud/client.ts")).EdgeV1Client({
    baseUrl: env.cloudBaseUrl,
    deviceId: "device-1",
    secret: "secret-1",
    fetchImpl,
  })

  const orchestrator = new ReplayOrchestrator({
    env,
    client,
    repositories,
    paths,
    getEdgeConfig: () => null,
    getEdgeConfigV2: () => currentConfig,
    fetchImpl,
  })

  const resumed = await resumeUnfinishedJobs({ repositories, orchestrator })
  assert.equal(resumed, 1)
  assert.ok(progress.includes("ready"))

  const job = repositories.getReplayJob(payload.replayRequestId)
  assert.equal(job?.lockedSourceId, SOURCE_FAILOVER)
  assert.equal(job?.configRevisionId, config.configRevision.id)
  assert.equal(job?.configSnapshot?.configRevision.id, config.configRevision.id)

  database.close()
  await rm(dir, { recursive: true, force: true })
})
