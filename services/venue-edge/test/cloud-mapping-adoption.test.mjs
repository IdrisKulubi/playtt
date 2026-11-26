import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { createNvrPasswordStore } from "../src/auth/nvr-secret-store.ts"
import { CameraStillPublisher } from "../src/cloud/camera-stills.ts"
import { EdgeRepositories } from "../src/local-storage/repositories.ts"
import { adoptCloudTableMappings } from "../src/setup/cloud-mapping-adoption.ts"
import { buildLocalConfigOverlay } from "../src/setup/local-config-overlay.ts"
import { initDatabase } from "../src/state/sqlite.ts"

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "fixtures", "edge-v2-one-nvr.json"), "utf8"),
)
const RECORDER_ID = fixture.recorders[0].id
const TABLE_1 = fixture.resources[0].resourceId
const TABLE_2 = "60000000-0000-4000-8000-000000000002"

async function createStack() {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-adopt-"))
  const database = initDatabase(join(dir, "venue-edge.sqlite"))
  const repositories = new EdgeRepositories(database.db)
  const nvr = repositories.insertLocalNvr({
    id: randomUUID(), label: "VIGI", vendor: "vigi", host: "192.168.0.84", rtspPort: 554,
    playbackPort: null, username: "admin", localConnectionKey: "local-nvr-1", enabled: true,
    testChannelKey: "1", timeMode: "unknown",
  })
  const cameras = {}
  for (const channel of ["1", "2", "3", "4"]) {
    cameras[channel] = repositories.insertLocalCamera({
      id: randomUUID(), nvrId: nvr.id, label: `Camera ${channel}`, channelKey: channel,
      streamProfile: "main", codec: "h264", enabled: channel === "1" || channel === "2",
    })
  }
  // Local setup: table 1 → camera 1, table 2 → camera 2, then published.
  for (const [table, channel] of [[TABLE_1, "1"], [TABLE_2, "2"]]) {
    repositories.upsertLocalResourcePolicy({
      resourceId: table, label: table === TABLE_1 ? "Table 1" : "Table 2", selectionMode: "automatic",
      manualSourceId: null, failureThreshold: 3, cooldownSeconds: 30, healthyThreshold: 2, autoFailback: true,
    })
    repositories.replaceLocalResourceRoutes(table, [
      { id: randomUUID(), cameraId: cameras[channel].id, priority: 1, captureModes: ["edge_buffer"], enabled: true },
    ])
  }
  repositories.updateCommissioningState({ publishedAt: "2026-11-25T10:00:00.000Z", completed: true })
  return { dir, database, repositories, nvr, cameras }
}

/** A cloud config where PlayTT admin assigned the given channels to the two tables. */
function cloudConfig({ table1, table2, publishedAt = "2026-11-25T11:00:00.000Z" }) {
  const sourceId = (channel) => `80000000-0000-4000-8000-00000000000${channel}`
  const sources = ["1", "2", "3", "4"].map((channel) => ({
    id: sourceId(channel), recorderId: RECORDER_ID, label: `Camera ${channel}`,
    channelKey: channel, streamProfile: "main", codec: "h264", enabled: true,
  }))
  const policy = (resourceId, channels) => ({
    resourceId, selectionMode: "automatic", manualSourceId: null,
    failover: { failureThreshold: 3, cooldownSeconds: 30, healthyThreshold: 2, autoFailback: true },
    candidates: channels.map((channel, index) => ({ sourceId: sourceId(channel), priority: index + 1, captureModes: ["edge_buffer"] })),
  })
  return {
    ...fixture,
    configRevision: { ...fixture.configRevision, version: 9, publishedAt },
    resources: [
      { ...fixture.resources[0], label: "Table 1", enabled: true },
      { ...fixture.resources[0], resourceId: TABLE_2, label: "Table 2", enabled: table2.length > 0 },
    ],
    sources,
    resourcePolicies: [policy(TABLE_1, table1), ...(table2.length ? [policy(TABLE_2, table2)] : [])],
  }
}

function routedChannels(repositories, cameras, table) {
  const byId = Object.fromEntries(Object.entries(cameras).map(([channel, camera]) => [camera.id, channel]))
  return repositories.listLocalResourceRoutes(table).filter((route) => route.enabled)
    .sort((a, b) => a.priority - b.priority).map((route) => byId[route.cameraId])
}

test("a camera swap published in PlayTT admin is applied on the venue PC", async () => {
  const { database, repositories, cameras } = await createStack()
  const config = cloudConfig({ table1: ["2"], table2: ["1"] })

  const result = adoptCloudTableMappings(repositories, config)
  assert.equal(result.adopted, true)
  assert.deepEqual(result.changedTables.sort(), ["Table 1", "Table 2"])
  assert.deepEqual(routedChannels(repositories, cameras, TABLE_1), ["2"])
  assert.deepEqual(routedChannels(repositories, cameras, TABLE_2), ["1"])
  assert.equal(repositories.getCommissioningState().completed, true, "a swap must not undo commissioning")

  // Applying the same revision again changes nothing.
  assert.equal(adoptCloudTableMappings(repositories, config).adopted, false)

  // The local overlay that drives capture now matches PlayTT.
  const overlay = buildLocalConfigOverlay(repositories, config)
  const table1Policy = overlay.resourcePolicies.find((policy) => policy.resourceId === TABLE_1)
  assert.equal(table1Policy.candidates[0].sourceId, cameras["2"].id)
  database.close()
})

test("assigning an unticked camera with a backup turns it on for replays", async () => {
  const { database, repositories, cameras } = await createStack()
  adoptCloudTableMappings(repositories, cloudConfig({ table1: ["3", "4"], table2: ["2"] }))
  assert.deepEqual(routedChannels(repositories, cameras, TABLE_1), ["3", "4"])
  assert.equal(repositories.getLocalCameraById(cameras["3"].id).enabled, true)
  assert.equal(repositories.getLocalCameraById(cameras["4"].id).enabled, true)
  database.close()
})

test("PlayTT mappings are ignored before the first publish and for older revisions", async () => {
  const { database, repositories, cameras } = await createStack()
  const older = cloudConfig({ table1: ["4"], table2: ["3"], publishedAt: "2026-11-25T09:00:00.000Z" })
  assert.equal(adoptCloudTableMappings(repositories, older).reason, "older_than_local_publish")

  repositories.updateCommissioningState({ publishedAt: null })
  assert.equal(adoptCloudTableMappings(repositories, cloudConfig({ table1: ["4"], table2: ["3"] })).reason, "not_published")
  assert.deepEqual(routedChannels(repositories, cameras, TABLE_1), ["1"])
  database.close()
})

test("a table PlayTT clears loses its camera; unknown cameras leave the table alone", async () => {
  const { database, repositories, cameras } = await createStack()
  adoptCloudTableMappings(repositories, cloudConfig({ table1: ["1"], table2: [] }))
  assert.deepEqual(routedChannels(repositories, cameras, TABLE_2), [])

  const unknown = cloudConfig({ table1: ["1"], table2: ["2"] })
  unknown.sources = unknown.sources.map((source) => source.channelKey === "2" ? { ...source, channelKey: "9" } : source)
  const result = adoptCloudTableMappings(repositories, unknown)
  assert.deepEqual(result.skippedTables, ["Table 2"])
  assert.deepEqual(routedChannels(repositories, cameras, TABLE_2), [])
  database.close()
})

test("camera stills: one sub-stream picture per channel is uploaded through a grant", async () => {
  const { dir, database, repositories } = await createStack()
  const passwordStore = createNvrPasswordStore({ dataDir: dir, secretStoreMode: "memory", venueMode: "simulate" })
  await passwordStore.set("local-nvr-1", "nvr-secret")
  const grants = []
  const puts = []
  const probedStreams = []
  const publisher = new CameraStillPublisher({
    repositories,
    passwordStore,
    isActive: () => true,
    client: {
      async requestCameraStillGrant(input) {
        grants.push(input)
        return { url: `https://r2.example/still-${input.channelKey}`, contentType: "image/jpeg" }
      },
    },
    async runFfmpegImpl({ args }) {
      const url = args[args.indexOf("-i") + 1]
      probedStreams.push(url.match(/\/live\/(\d+)\/(\d)\//).slice(1).join("/"))
      await writeFile(args[args.length - 1], Buffer.from("jpeg-bytes"))
      return { exitCode: 0, stdout: "", stderr: "", timedOut: false, cancelled: false }
    },
    async fetchImpl(url, init) {
      puts.push({ url, method: init.method, type: init.headers["content-type"] })
      return { ok: true, status: 200 }
    },
  })

  assert.equal(await publisher.publishOnce(), 4)
  assert.deepEqual(probedStreams, ["1/2", "2/2", "3/2", "4/2"], "sub-stream is tried first")
  assert.deepEqual(grants.map((grant) => grant.channelKey), ["1", "2", "3", "4"])
  assert.ok(grants.every((grant) => grant.localConnectionKey === "local-nvr-1" && grant.contentLength === 10))
  assert.ok(puts.every((put) => put.method === "PUT" && put.type === "image/jpeg"))
  assert.ok(grants.every((grant) => !JSON.stringify(grant).includes("nvr-secret")), "the NVR password is never sent")
  database.close()
})
