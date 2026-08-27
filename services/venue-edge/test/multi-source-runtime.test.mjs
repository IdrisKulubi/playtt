import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { mkdtemp } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"

import {
  checksumEdgeConfigSnapshot,
  formatEdgeConfigChecksum,
} from "../src/cloud/config-v2-checksum.ts"
import { parseEdgeConfigV2 } from "../src/cloud/config-v2.ts"
import {
  getCameraForResource,
  listBufferingCameras,
  listBufferingSourceIds,
} from "../src/cameras/registry.ts"
import { SourceSupervisorRegistry } from "../src/buffers/registry.ts"
import { RollingBufferSupervisor } from "../src/buffers/rolling-buffer.ts"
import { buildSourcePlan } from "../src/config/source-plan.ts"
import {
  evaluateBufferStartBudget,
  evaluateNetworkBudget,
} from "../src/config/budgets.ts"
import { loadEnv } from "../src/config/env.ts"
import { EdgeRepositories } from "../src/local-storage/repositories.ts"
import { initDatabase } from "../src/state/sqlite.ts"
import { createLocalStoragePaths } from "../src/local-storage/paths.ts"

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

async function createRegistryStack(options = {}) {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-multi-"))
  const env = loadEnv({
    mode: "simulate",
    dataDir: dir,
    sqlitePath: join(dir, "venue-edge.sqlite"),
    maxBufferProcesses: options.maxBufferProcesses ?? 8,
    minFreeMemoryBytes: 0,
    reservedFreeDiskBytes: 0,
    rtspUrl: options.rtspUrl ?? null,
  })
  const paths = createLocalStoragePaths(env)
  const database = initDatabase(env.sqlitePath)
  const repositories = new EdgeRepositories(database.db)
  const registry = new SourceSupervisorRegistry(env, paths, repositories)

  return { dir, env, paths, database, repositories, registry }
}

test("listBufferingCameras starts all edge_buffer sources from three-nvr fixture", () => {
  const fixture = withValidChecksum(loadFixture("edge-v2-three-nvr.json"))
  const config = parseEdgeConfigV2(fixture)
  const env = loadEnv({ mode: "simulate" })

  const sourceIds = listBufferingSourceIds(config)
  assert.deepEqual(sourceIds, [
    "80000000-0000-4000-8000-000000000001",
    "80000000-0000-4000-8000-000000000003",
    "80000000-0000-4000-8000-000000000004",
    "80000000-0000-4000-8000-000000000005",
  ])

  const cameras = listBufferingCameras(env, null, config)
  assert.equal(cameras.length, 4)
  assert.equal(cameras[0].cameraId, sourceIds[0])
})

test("production multi-source cameras resolve distinct configured RTSP URLs", () => {
  const fixture = withValidChecksum(loadFixture("edge-v2-three-nvr.json"))
  const config = parseEdgeConfigV2(fixture)
  const sourceIds = listBufferingSourceIds(config)
  const sourceRtspUrls = Object.fromEntries(
    sourceIds.map((sourceId, index) => [
      sourceId,
      `rtsp://nvr-${index + 1}.local/channel/${index + 1}`,
    ])
  )
  const env = loadEnv({ mode: "buffer", sourceRtspUrls })

  const cameras = listBufferingCameras(env, null, config)
  assert.equal(cameras.length, sourceIds.length)
  for (const camera of cameras) {
    assert.equal(camera.rtspUrl, sourceRtspUrls[camera.cameraId])
  }
})

test("non-simulated rolling buffer fails closed without an RTSP URL", async () => {
  const { database, repositories, paths } = await createRegistryStack()
  const supervisor = new RollingBufferSupervisor(
    {
      cameraId: "missing-source",
      label: "Missing source",
      rtspUrl: null,
      bufferSeconds: 120,
    },
    paths,
    repositories,
    { simulate: false }
  )

  await assert.rejects(
    () => supervisor.start(),
    /SOURCE_RTSP_URL_MISSING:missing-source/
  )
  assert.equal(supervisor.isRunning(), false)
  database.close()
})

test("registry starts isolated supervisors per buffering source", async () => {
  const { database, registry } = await createRegistryStack()
  const fixture = withValidChecksum(loadFixture("edge-v2-three-nvr.json"))
  const config = parseEdgeConfigV2(fixture)

  await registry.ensureAllBuffering(null, config)

  assert.equal(registry.getBufferingSourceCount(), 4)
  assert.equal(registry.getRunningCount(), 4)

  for (const sourceId of listBufferingSourceIds(config)) {
    const supervisor = registry.getSupervisor(sourceId)
    assert.ok(supervisor?.isRunning(), `expected ${sourceId} running`)
    assert.equal(supervisor?.getCameraId(), sourceId)
  }

  await registry.stopAll()
  database.close()
})

test("reconcile disable stops only the disabled source supervisor", async () => {
  const { database, registry } = await createRegistryStack()
  const base = withValidChecksum(loadFixture("edge-v2-three-nvr.json"))
  const previousConfig = parseEdgeConfigV2(base)
  const nextConfig = structuredClone(previousConfig)
  const disabledSource = nextConfig.sources.find(
    (source) => source.id === "80000000-0000-4000-8000-000000000003"
  )
  assert.ok(disabledSource)
  disabledSource.enabled = false

  await registry.ensureAllBuffering(null, previousConfig)
  assert.equal(registry.getBufferingSourceCount(), 4)

  const plan = buildSourcePlan(previousConfig, nextConfig)
  await registry.reconcile({
    edgeConfig: null,
    edgeConfigV2: nextConfig,
    sourcePlan: plan,
  })

  assert.equal(
    registry.getSupervisor("80000000-0000-4000-8000-000000000003"),
    undefined
  )
  assert.equal(
    registry.getSupervisor("80000000-0000-4000-8000-000000000001")?.isRunning(),
    true
  )
  assert.equal(
    registry.getSupervisor("80000000-0000-4000-8000-000000000004")?.isRunning(),
    true
  )

  await registry.stopAll()
  database.close()
})

test("budget defers additional buffer starts when maxBufferProcesses is 1", async () => {
  const { database, registry } = await createRegistryStack({
    maxBufferProcesses: 1,
  })
  const fixture = withValidChecksum(loadFixture("edge-v2-three-nvr.json"))
  const config = parseEdgeConfigV2(fixture)

  await registry.ensureAllBuffering(null, config)

  assert.equal(registry.getBufferingSourceCount(), 1)
  assert.equal(registry.getRunningCount(), 1)

  await registry.stopAll()
  database.close()
})

test("update restarts only the affected source supervisor", async () => {
  const { database, registry } = await createRegistryStack()
  const base = withValidChecksum(loadFixture("edge-v2-one-nvr.json"))
  const previousConfig = parseEdgeConfigV2(base)

  await registry.ensureAllBuffering(null, previousConfig)
  const original = registry.getSupervisor(
    "80000000-0000-4000-8000-000000000001"
  )
  assert.ok(original?.isRunning())

  const updated = withValidChecksum({
    ...base,
    sources: [
      {
        ...base.sources[0],
        label: "Table 1 camera updated label",
      },
    ],
  })
  const nextConfig = parseEdgeConfigV2(updated)
  const plan = buildSourcePlan(previousConfig, nextConfig)

  await registry.reconcile({
    edgeConfig: null,
    edgeConfigV2: nextConfig,
    sourcePlan: plan,
  })

  const restarted = registry.getSupervisor(
    "80000000-0000-4000-8000-000000000001"
  )
  assert.ok(restarted?.isRunning())

  await registry.stopAll()
  database.close()
})

test("getCameraForResource maps resources to distinct buffering sources", () => {
  const fixture = withValidChecksum(loadFixture("edge-v2-three-nvr.json"))
  const config = parseEdgeConfigV2(fixture)
  const env = loadEnv({ mode: "simulate" })

  const table1 = getCameraForResource(
    env,
    null,
    config,
    "60000000-0000-4000-8000-000000000001"
  )
  const table2 = getCameraForResource(
    env,
    null,
    config,
    "60000000-0000-4000-8000-000000000002"
  )

  assert.equal(table1.cameraId, "80000000-0000-4000-8000-000000000001")
  assert.equal(table2.cameraId, "80000000-0000-4000-8000-000000000003")
  assert.notEqual(table1.cameraId, table2.cameraId)
})

test("evaluateBufferStartBudget enforces max buffer process cap", async () => {
  const env = loadEnv({
    maxBufferProcesses: 2,
    minFreeMemoryBytes: 0,
    reservedFreeDiskBytes: 0,
  })

  const allowed = await evaluateBufferStartBudget(env, 1)
  assert.equal(allowed.allowed, true)

  const blocked = await evaluateBufferStartBudget(env, 2)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.reason, "max_buffer_processes")
})

test("network admission budget blocks projected stream bandwidth", () => {
  const env = loadEnv({
    maxNetworkMbps: 16,
    estimatedSourceNetworkMbps: 8,
  })

  assert.deepEqual(evaluateNetworkBudget(env, 1), { allowed: true })
  assert.deepEqual(evaluateNetworkBudget(env, 2), {
    allowed: false,
    reason: "network_pressure",
  })
})
