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
import { EdgeConfigV2Manager } from "../src/config/apply-v2.ts"
import {
  buildSourcePlan,
  shouldKeepBufferRunning,
  shouldRestartBuffer,
} from "../src/config/source-plan.ts"
import {
  commandMatchesActiveConfig,
  resolveCameraSourceFromV2,
} from "../src/cameras/source.ts"
import { EdgeRepositories } from "../src/local-storage/repositories.ts"
import { initDatabase } from "../src/state/sqlite.ts"
import { loadEnv } from "../src/config/env.ts"

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

function createMockClient(options = {}) {
  const ackCalls = []
  return {
    ackCalls,
    async getConfigV2() {
      if (options.getConfigV2Error) {
        throw options.getConfigV2Error
      }
      return options.getConfigV2Result ?? null
    },
    async acknowledgeConfigV2Application(input) {
      ackCalls.push(input)
      return {
        id: "ack-id",
        installationId: input.installationId,
        configRevisionId: input.configRevisionId,
        status: input.status,
        attemptedAt: new Date().toISOString(),
        appliedAt: input.status === "applied" ? new Date().toISOString() : null,
        idempotent: false,
      }
    },
  }
}

async function createTestStack() {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-config-"))
  const sqlitePath = join(dir, "venue-edge.sqlite")
  const database = initDatabase(sqlitePath)
  const repositories = new EdgeRepositories(database.db)
  const client = createMockClient()
  const manager = new EdgeConfigV2Manager(repositories, client, "boot-test")

  return {
    dir,
    database,
    repositories,
    client,
    manager,
  }
}

test("applyConfigSnapshot moves prior current into previous on second apply", async () => {
  const { database, repositories, manager } = await createTestStack()
  const first = withValidChecksum(loadFixture("edge-v2-one-nvr.json"))
  const second = withValidChecksum({
    ...loadFixture("edge-v2-one-nvr.json"),
    configRevision: {
      ...loadFixture("edge-v2-one-nvr.json").configRevision,
      id: "66666666-6666-4666-8666-666666666666",
      version: 2,
      publishedAt: "2026-08-26T10:00:00.000Z",
    },
    sources: [
      {
        ...loadFixture("edge-v2-one-nvr.json").sources[0],
        label: "Table 1 camera updated",
      },
    ],
  })

  const firstResult = await manager.applyValidatedSnapshot(first, {
    acknowledge: false,
  })
  assert.equal(firstResult.applied, true)

  const currentAfterFirst = repositories.getCurrentConfig()
  assert.equal(currentAfterFirst?.revisionId, first.configRevision.id)
  assert.equal(repositories.getPreviousConfig(), null)

  const secondResult = await manager.applyValidatedSnapshot(second, {
    acknowledge: false,
  })
  assert.equal(secondResult.applied, true)

  const current = repositories.getCurrentConfig()
  const previous = repositories.getPreviousConfig()
  assert.equal(current?.revisionId, second.configRevision.id)
  assert.equal(previous?.revisionId, first.configRevision.id)
  assert.equal(previous?.version, 1)

  database.close()
})

test("invalid snapshot does not overwrite last-known-good", async () => {
  const { database, repositories, manager } = await createTestStack()
  const valid = withValidChecksum(loadFixture("edge-v2-one-nvr.json"))
  await manager.applyValidatedSnapshot(valid, { acknowledge: false })

  const invalid = structuredClone(valid)
  invalid.recorders[0].password = "must-not-cross-cloud-boundary"

  const result = await manager.applyValidatedSnapshot(invalid, {
    acknowledge: false,
  })
  assert.equal(result.applied, false)
  assert.equal(result.errorCode, "CONFIG_INVALID")

  const current = repositories.getCurrentConfig()
  assert.equal(current?.revisionId, valid.configRevision.id)

  const badChecksum = structuredClone(valid)
  badChecksum.configRevision.checksum =
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  const checksumResult = await manager.applyValidatedSnapshot(badChecksum, {
    acknowledge: false,
  })
  assert.equal(checksumResult.applied, false)
  assert.equal(checksumResult.errorCode, "CONFIG_CHECKSUM_MISMATCH")
  assert.equal(
    repositories.getCurrentConfig()?.revisionId,
    valid.configRevision.id
  )

  database.close()
})

test("stale config revisions cannot replace the current snapshot", async () => {
  const { database, repositories, manager } = await createTestStack()
  const base = loadFixture("edge-v2-one-nvr.json")
  const current = withValidChecksum({
    ...base,
    configRevision: {
      ...base.configRevision,
      id: "66666666-6666-4666-8666-666666666666",
      version: 2,
    },
  })
  const stale = withValidChecksum({
    ...base,
    configRevision: {
      ...base.configRevision,
      id: "77777777-7777-4777-8777-777777777777",
      version: 1,
    },
  })

  await manager.applyValidatedSnapshot(current, { acknowledge: false })
  const result = await manager.applyValidatedSnapshot(stale, {
    acknowledge: false,
  })

  assert.equal(result.applied, false)
  assert.equal(result.errorCode, "CONFIG_STALE")
  assert.equal(
    repositories.getCurrentConfig()?.revisionId,
    current.configRevision.id
  )
  database.close()
})

test("runtime activation failure keeps the previous config and rejects the new revision", async () => {
  const { database, repositories, manager } = await createTestStack()
  const first = withValidChecksum(loadFixture("edge-v2-one-nvr.json"))
  const second = withValidChecksum({
    ...loadFixture("edge-v2-one-nvr.json"),
    configRevision: {
      ...loadFixture("edge-v2-one-nvr.json").configRevision,
      id: "66666666-6666-4666-8666-666666666666",
      version: 2,
    },
  })
  const activatedVersions = []

  await manager.applyValidatedSnapshot(first, { acknowledge: false })
  const result = await manager.applyValidatedSnapshot(second, {
    acknowledge: false,
    activate: async (config) => {
      activatedVersions.push(config?.configRevision.version ?? null)
      if (config?.configRevision.version === 2) {
        throw new Error("SUPERVISOR_START_FAILED")
      }
    },
  })

  assert.equal(result.applied, false)
  assert.deepEqual(activatedVersions, [2, 1])
  assert.equal(
    repositories.getCurrentConfig()?.revisionId,
    first.configRevision.id
  )
  assert.equal(
    manager.getState().edgeConfigV2?.configRevision.id,
    first.configRevision.id
  )
  database.close()
})

test("restart reloads current snapshot from sqlite", async () => {
  const { database, repositories, manager, dir } = await createTestStack()
  const valid = withValidChecksum(loadFixture("edge-v2-one-nvr.json"))
  await manager.applyValidatedSnapshot(valid, { acknowledge: false })

  database.close()

  const reopened = initDatabase(join(dir, "venue-edge.sqlite"))
  const reopenedRepos = new EdgeRepositories(reopened.db)
  const reopenedManager = new EdgeConfigV2Manager(
    reopenedRepos,
    createMockClient(),
    "boot-restart"
  )

  const loaded = reopenedManager.loadLastKnownGoodFromDisk()
  assert.equal(loaded?.configRevision.id, valid.configRevision.id)
  assert.equal(
    reopenedManager.getState().appliedConfigVersion,
    valid.configRevision.version
  )

  reopened.close()
})

test("offline apply persists without calling cloud", async () => {
  const { database, repositories, manager } = await createTestStack()
  const valid = withValidChecksum(loadFixture("edge-v2-one-nvr.json"))
  const client = createMockClient()
  const offlineManager = new EdgeConfigV2Manager(
    repositories,
    client,
    "boot-offline"
  )

  const result = await offlineManager.applyValidatedSnapshot(valid, {
    acknowledge: false,
  })
  assert.equal(result.applied, true)
  assert.equal(client.ackCalls.length, 0)
  assert.equal(
    repositories.getCurrentConfig()?.revisionId,
    valid.configRevision.id
  )

  database.close()
})

test("source plan marks disable and unchanged siblings", () => {
  let previous = structuredClone(loadFixture("edge-v2-disabled-source.json"))
  previous.sources[1].enabled = true
  previous = withValidChecksum(previous)
  const next = withValidChecksum(loadFixture("edge-v2-disabled-source.json"))

  const plan = buildSourcePlan(previous, next)
  const disabledEntry = plan.entries.find(
    (entry) => entry.sourceId === "80000000-0000-4000-8000-000000000002"
  )
  assert.equal(disabledEntry?.action, "disable")

  const unchangedEntry = plan.entries.find(
    (entry) => entry.sourceId === "80000000-0000-4000-8000-000000000001"
  )
  assert.equal(unchangedEntry?.action, "unchanged")

  assert.equal(
    shouldKeepBufferRunning(plan, "80000000-0000-4000-8000-000000000001"),
    true
  )
  assert.equal(
    shouldRestartBuffer(plan, "80000000-0000-4000-8000-000000000001"),
    false
  )
})

test("source plan restarts sources when recorder connection changes", () => {
  const previous = withValidChecksum(loadFixture("edge-v2-one-nvr.json"))
  const next = structuredClone(previous)
  next.recorders[0].connection.host = "192.168.10.99"

  const plan = buildSourcePlan(previous, next)
  assert.equal(plan.entries[0]?.action, "update")
})

test("acknowledge applied and rejected config applications", async () => {
  const { database, repositories } = await createTestStack()
  const valid = withValidChecksum(loadFixture("edge-v2-one-nvr.json"))
  const client = createMockClient()
  const manager = new EdgeConfigV2Manager(repositories, client, "boot-ack")

  await manager.applyValidatedSnapshot(valid, { acknowledge: true })
  assert.equal(client.ackCalls.length, 1)
  assert.deepEqual(client.ackCalls[0], {
    installationId: valid.installation.id,
    configRevisionId: valid.configRevision.id,
    status: "applied",
    bootId: "boot-ack",
  })

  const invalid = structuredClone(valid)
  invalid.recorders[0].password = "secret"
  await manager.applyValidatedSnapshot(invalid, { acknowledge: true })
  assert.equal(client.ackCalls.length, 2)
  assert.equal(client.ackCalls[1].status, "rejected")
  assert.equal(client.ackCalls[1].errorCode, "CONFIG_INVALID")

  database.close()
})

test("refreshFromCloud keeps LKG when fetch fails", async () => {
  const { database, repositories } = await createTestStack()
  const valid = withValidChecksum(loadFixture("edge-v2-one-nvr.json"))
  const client = createMockClient({
    getConfigV2Error: new Error("network down"),
  })
  const manager = new EdgeConfigV2Manager(repositories, client, "boot-outage")
  await manager.applyValidatedSnapshot(valid, { acknowledge: false })

  const result = await manager.refreshFromCloud()
  assert.equal(result.applied, false)
  assert.equal(result.idempotent, true)
  assert.equal(
    manager.getState().edgeConfigV2?.configRevision.id,
    valid.configRevision.id
  )

  database.close()
})

test("commands match enabled v2 resources from LKG", () => {
  const config = withValidChecksum(loadFixture("edge-v2-one-nvr.json"))
  const resourceId = config.resources[0].resourceId

  const accepted = commandMatchesActiveConfig(
    null,
    config,
    resourceId,
    config.configRevision.id
  )
  assert.equal(accepted.accepted, true)

  const rejected = commandMatchesActiveConfig(
    null,
    config,
    "99999999-9999-4999-8999-999999999999",
    config.configRevision.id
  )
  assert.equal(rejected.accepted, false)
  assert.equal(rejected.reason, "resource_not_configured")

  const stale = commandMatchesActiveConfig(
    null,
    config,
    resourceId,
    "66666666-6666-4666-8666-666666666666"
  )
  assert.deepEqual(stale, { accepted: false, reason: "stale_config" })
})

test("resolveCameraSourceFromV2 uses primary enabled buffering source", () => {
  const config = withValidChecksum(loadFixture("edge-v2-one-nvr.json"))
  const env = loadEnv({
    rtspUrl: "rtsp://127.0.0.1/stream",
    mode: "simulate",
  })

  const source = resolveCameraSourceFromV2(env, config)
  assert.equal(source?.cameraId, "80000000-0000-4000-8000-000000000001")
  assert.equal(source?.rtspUrl, "rtsp://127.0.0.1/stream")
})
