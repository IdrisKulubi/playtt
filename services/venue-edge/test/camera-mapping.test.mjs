import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { CredentialManager } from "../src/auth/credential-manager.ts"
import { createNvrPasswordStore } from "../src/auth/nvr-secret-store.ts"
import {
  checksumEdgeConfigSnapshot,
  formatEdgeConfigChecksum,
} from "../src/cloud/config-v2-checksum.ts"
import { parseEdgeConfigV2 } from "../src/cloud/config-v2.ts"
import { EdgeRepositories } from "../src/local-storage/repositories.ts"
import { initDatabase } from "../src/state/sqlite.ts"
import { LocalNvrManager } from "../src/setup/local-nvr-manager.ts"
import { LocalCameraManager } from "../src/setup/local-camera-manager.ts"
import { LocalResourceMappingManager } from "../src/setup/local-resource-mapping-manager.ts"
import { resolveRuntimeEdgeConfigV2 } from "../src/setup/local-config-overlay.ts"
import { startSetupHost, stopSetupHost } from "../src/setup/host.ts"

const fixturesRoot = join(import.meta.dirname, "..", "fixtures")

function loadFixture(name) {
  return JSON.parse(readFileSync(join(fixturesRoot, name), "utf8"))
}

function withValidChecksum(fixture) {
  const topology = {
    resources: fixture.resources,
    recorders: fixture.recorders,
    sources: fixture.sources,
    resourcePolicies: fixture.resourcePolicies,
  }
  const digest = checksumEdgeConfigSnapshot(topology)
  return {
    ...fixture,
    configRevision: {
      ...fixture.configRevision,
      checksum: formatEdgeConfigChecksum(digest),
    },
  }
}

function setupFetch(port, token) {
  return async (path, init = {}) => {
    const headers = new Headers(init.headers ?? {})
    headers.set("X-VenueEdge-Setup-Token", token)
    headers.set("Host", `127.0.0.1:${port}`)
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }

    return fetch(`http://127.0.0.1:${port}${path}`, {
      ...init,
      headers,
    })
  }
}

function createChannelProbe(liveChannels) {
  return {
    async probe({ liveRtspUrl }) {
      const match = liveRtspUrl.match(/\/live\/([^/]+)\//)
      const channel = match?.[1]
      const live = channel ? liveChannels.has(channel) : false
      return { live, codec: "h264" }
    },
  }
}

async function createTestStack(options = {}) {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-camera-"))
  const database = initDatabase(join(dir, "venue-edge.sqlite"))
  const repositories = new EdgeRepositories(database.db)
  const passwordStore = createNvrPasswordStore({
    dataDir: dir,
    secretStoreMode: "memory",
    venueMode: "simulate",
  })
  const nvrManager = new LocalNvrManager(repositories, passwordStore)
  const cameraManager = new LocalCameraManager(
    repositories,
    passwordStore,
    nvrManager,
    options.channelProbe,
  )
  const credentialManager = new CredentialManager(
    join(dir, "installation.json"),
    join(dir, "credentials.dpapi"),
    "memory",
    "simulate",
  )

  let edgeConfigV2 = null
  if (options.fixture) {
    const fixture = withValidChecksum(loadFixture(options.fixture))
    edgeConfigV2 = parseEdgeConfigV2(fixture)
    repositories.applyConfigSnapshot({
      revisionId: edgeConfigV2.configRevision.id,
      version: edgeConfigV2.configRevision.version,
      checksum: edgeConfigV2.configRevision.checksum,
      installationId: edgeConfigV2.installation.id,
      publishedAt: edgeConfigV2.configRevision.publishedAt,
      snapshot: edgeConfigV2,
      appliedAt: new Date().toISOString(),
      bootId: "test-boot",
    })
  }

  const mappingManager = new LocalResourceMappingManager(
    repositories,
    () => edgeConfigV2,
  )

  return {
    dir,
    database,
    repositories,
    passwordStore,
    nvrManager,
    cameraManager,
    mappingManager,
    credentialManager,
    edgeConfigV2,
  }
}

test("three NVRs, cameras, and enable subset; list omits secrets", async () => {
  const { nvrManager, cameraManager } = await createTestStack()

  const nvrIds = []
  for (let index = 1; index <= 3; index += 1) {
    const nvr = await nvrManager.createNvr({
      label: `NVR ${index}`,
      vendor: "vigi",
      host: `192.168.10.${index}`,
      rtspPort: 554,
      username: "playtt_edge",
      password: `secret-${index}`,
      testChannelKey: String(index),
    })
    nvrIds.push(nvr.id)

    await cameraManager.createCamera({
      nvrId: nvr.id,
      channelKey: String(index),
      streamProfile: "main",
    })
  }

  const cameras = await cameraManager.listPublicCameras()
  assert.equal(cameras.length, 3)

  await cameraManager.updateCamera(cameras[0].id, { enabled: true })
  await cameraManager.updateCamera(cameras[1].id, { enabled: true })

  const listed = await cameraManager.listPublicCameras()
  const serialized = JSON.stringify(listed)
  assert.doesNotMatch(serialized, /secret-/i)
  assert.doesNotMatch(serialized, /rtsp:/i)
  assert.equal(listed.filter((camera) => camera.enabled).length, 2)
})

test("restart sqlite preserves cameras, routes, and policy", async () => {
  const {
    dir,
    database,
    repositories,
    passwordStore,
    nvrManager,
    cameraManager,
    mappingManager,
    edgeConfigV2,
  } = await createTestStack({ fixture: "edge-v2-one-nvr.json" })

  const nvr = await nvrManager.createNvr({
    label: "Main NVR",
    vendor: "vigi",
    host: "192.168.10.20",
    rtspPort: 554,
    username: "playtt_edge",
    password: "persist-secret",
    testChannelKey: "1",
  })

  const camera = await cameraManager.createCamera({
    nvrId: nvr.id,
    channelKey: "1",
    streamProfile: "main",
    enabled: true,
  })

  const resourceId = edgeConfigV2.resources[0].resourceId
  mappingManager.putResourcePolicy(resourceId, {
    selectionMode: "automatic",
    autoFailback: true,
    candidates: [
      {
        cameraId: camera.id,
        priority: 1,
        captureModes: ["edge_buffer"],
        enabled: true,
      },
    ],
  })

  database.close()

  const reopened = initDatabase(join(dir, "venue-edge.sqlite"))
  const reopenedRepositories = new EdgeRepositories(reopened.db)
  const reopenedNvrManager = new LocalNvrManager(
    reopenedRepositories,
    passwordStore,
  )
  const reopenedCameraManager = new LocalCameraManager(
    reopenedRepositories,
    passwordStore,
    reopenedNvrManager,
  )
  const reopenedMappingManager = new LocalResourceMappingManager(
    reopenedRepositories,
    () => edgeConfigV2,
  )

  const cameras = await reopenedCameraManager.listPublicCameras()
  assert.equal(cameras.length, 1)
  assert.equal(cameras[0].channelKey, "1")

  const policy = reopenedMappingManager.getResourcePolicy(resourceId)
  assert.equal(policy?.candidates.length, 1)
  assert.equal(policy?.candidates[0].cameraId, camera.id)

  reopened.close()
})

test("PUT policy reorders fallback and rejects disabled camera candidates", async () => {
  const { nvrManager, cameraManager, mappingManager, edgeConfigV2 } =
    await createTestStack({ fixture: "edge-v2-one-nvr.json" })

  const nvr = await nvrManager.createNvr({
    label: "Main NVR",
    vendor: "vigi",
    host: "192.168.10.20",
    rtspPort: 554,
    username: "playtt_edge",
    password: "policy-secret",
    testChannelKey: "1",
  })

  const primary = await cameraManager.createCamera({
    nvrId: nvr.id,
    channelKey: "1",
    streamProfile: "main",
    enabled: true,
  })
  const fallback = await cameraManager.createCamera({
    nvrId: nvr.id,
    channelKey: "2",
    streamProfile: "main",
    enabled: true,
  })

  const resourceId = edgeConfigV2.resources[0].resourceId

  const first = mappingManager.putResourcePolicy(resourceId, {
    candidates: [
      {
        cameraId: primary.id,
        priority: 1,
        captureModes: ["edge_buffer"],
        enabled: true,
      },
      {
        cameraId: fallback.id,
        priority: 2,
        captureModes: ["edge_buffer"],
        enabled: true,
      },
    ],
  })
  assert.equal(first.candidates[0].cameraId, primary.id)
  assert.equal(first.candidates[1].cameraId, fallback.id)

  const reordered = mappingManager.putResourcePolicy(resourceId, {
    candidates: [
      {
        cameraId: fallback.id,
        priority: 1,
        captureModes: ["edge_buffer"],
        enabled: true,
      },
      {
        cameraId: primary.id,
        priority: 2,
        captureModes: ["edge_buffer"],
        enabled: true,
      },
    ],
  })
  assert.equal(reordered.candidates[0].cameraId, fallback.id)

  const disabled = await cameraManager.createCamera({
    nvrId: nvr.id,
    channelKey: "3",
    streamProfile: "main",
    enabled: false,
  })

  assert.throws(
    () =>
      mappingManager.putResourcePolicy(resourceId, {
        candidates: [
          {
            cameraId: disabled.id,
            priority: 1,
            captureModes: ["edge_buffer"],
            enabled: true,
          },
        ],
      }),
    /enabled for capture/,
  )
})

test("duplicate mapping returns warnings without failing", async () => {
  const {
    repositories,
    nvrManager,
    cameraManager,
    edgeConfigV2,
  } = await createTestStack({ fixture: "edge-v2-one-nvr.json" })

  const nvr = await nvrManager.createNvr({
    label: "Main NVR",
    vendor: "vigi",
    host: "192.168.10.20",
    rtspPort: 554,
    username: "playtt_edge",
    password: "dup-secret",
    testChannelKey: "1",
  })

  const camera = await cameraManager.createCamera({
    nvrId: nvr.id,
    channelKey: "1",
    streamProfile: "main",
    enabled: true,
  })

  const resourceId = edgeConfigV2.resources[0].resourceId
  const otherResourceId = randomUUID()

  const extendedConfig = {
    ...edgeConfigV2,
    resources: [
      ...edgeConfigV2.resources,
      {
        resourceId: otherResourceId,
        tenantId: edgeConfigV2.installation.tenantId,
        venueId: edgeConfigV2.installation.venueId,
        label: "Table 2",
        enabled: true,
      },
    ],
  }

  const mappingWithTwoResources = new LocalResourceMappingManager(
    repositories,
    () => extendedConfig,
  )

  mappingWithTwoResources.putResourcePolicy(resourceId, {
    candidates: [
      {
        cameraId: camera.id,
        priority: 1,
        captureModes: ["edge_buffer"],
        enabled: true,
      },
    ],
  })

  const warned = mappingWithTwoResources.putResourcePolicy(otherResourceId, {
    candidates: [
      {
        cameraId: camera.id,
        priority: 1,
        captureModes: ["edge_buffer"],
        enabled: true,
      },
    ],
  })

  assert.ok(
    warned.warnings.some((warning) => warning.code === "duplicate_mapping"),
  )
})

test("enumerate with fake probe creates only live channels", async () => {
  const liveChannels = new Set(["1", "3", "5"])
  const { nvrManager, cameraManager } = await createTestStack({
    channelProbe: createChannelProbe(liveChannels),
  })

  const nvr = await nvrManager.createNvr({
    label: "Enumerate NVR",
    vendor: "vigi",
    host: "192.168.10.50",
    rtspPort: 554,
    username: "playtt_edge",
    password: "enum-secret",
    testChannelKey: "1",
  })

  const result = await cameraManager.enumerateCameras(nvr.id, { maxChannels: 6 })
  assert.equal(result.created.length, 3)
  const channels = result.created.map((camera) => camera.channelKey).sort()
  assert.deepEqual(channels, ["1", "3", "5"])
})

test("enumeration rescans existing channels and marks failed probes unavailable", async () => {
  const liveChannels = new Set(["1"])
  const { nvrManager, cameraManager } = await createTestStack({
    channelProbe: createChannelProbe(liveChannels),
  })
  const nvr = await nvrManager.createNvr({
    label: "Rescan NVR",
    vendor: "vigi",
    host: "192.168.10.51",
    rtspPort: 554,
    username: "playtt_edge",
    password: "enum-secret",
    testChannelKey: "1",
  })

  const first = await cameraManager.enumerateCameras(nvr.id, { maxChannels: 1 })
  assert.equal(first.created.length, 1)
  liveChannels.clear()

  const second = await cameraManager.enumerateCameras(nvr.id, { maxChannels: 1 })
  assert.equal(second.created.length, 0)
  assert.equal(second.unavailable.length, 1)
  assert.equal(second.unavailable[0].id, first.created[0].id)
  assert.equal(second.unavailable[0].lastTest.passed, false)
  assert.equal(second.unavailable[0].codec, "unknown")
})

test("setup camera and mapping APIs require setup token", async () => {
  const { nvrManager, cameraManager, mappingManager, credentialManager } =
    await createTestStack({ fixture: "edge-v2-one-nvr.json" })

  const host = await startSetupHost({
    port: 0,
    sessionTtlMs: 60_000,
    credentialManager,
    localNvrManager: nvrManager,
    localCameraManager: cameraManager,
    localResourceMappingManager: mappingManager,
  })

  const port = host.port
  const token = host.session.token
  const fetchSetup = setupFetch(port, token)

  const missing = await fetch(`http://127.0.0.1:${port}/api/setup/cameras`, {
    headers: { Host: `127.0.0.1:${port}` },
  })
  assert.equal(missing.status, 401)

  const resourcesMissing = await fetch(
    `http://127.0.0.1:${port}/api/setup/resources`,
    { headers: { Host: `127.0.0.1:${port}` } },
  )
  assert.equal(resourcesMissing.status, 401)

  const listed = await (await fetchSetup("/api/setup/cameras")).json()
  assert.ok(Array.isArray(listed.cameras))

  const resources = await (await fetchSetup("/api/setup/resources")).json()
  assert.equal(resources.resources.length, 1)

  await stopSetupHost(host)
})

test("runtime RTSP resolves from local camera channel when env JSON is empty", async () => {
  const { nvrManager, cameraManager, edgeConfigV2 } = await createTestStack({
    fixture: "edge-v2-one-nvr.json",
  })

  const nvr = await nvrManager.createNvr({
    label: "Main NVR",
    vendor: "vigi",
    host: "192.168.10.20",
    rtspPort: 554,
    username: "playtt_edge",
    password: "runtime-secret",
    testChannelKey: "1",
  })

  const localConnectionKey = nvr.localConnectionKey
  const recorder = edgeConfigV2.recorders[0]
  recorder.localConnectionKey = localConnectionKey

  const camera = await cameraManager.createCamera({
    nvrId: nvr.id,
    channelKey: "4",
    streamProfile: "main",
    enabled: true,
  })

  edgeConfigV2.sources[0].channelKey = "4"

  const map = await cameraManager.buildRuntimeSourceRtspMap(edgeConfigV2)
  const sourceId = edgeConfigV2.sources[0].id

  assert.match(map[sourceId], /^rtsp:\/\/playtt_edge:/)
  assert.match(map[sourceId], /\/live\/4\/1\/avm/)
})

test("runtime config replaces cloud camera policy with commissioned local choices", async () => {
  const stack = await createTestStack({ fixture: "edge-v2-one-nvr.json" })
  const nvr = await stack.nvrManager.createNvr({
    label: "Local NVR",
    vendor: "vigi",
    host: "192.168.10.20",
    rtspPort: 554,
    username: "playtt_edge",
    password: "protected-secret",
    testChannelKey: "1",
  })
  const primary = await stack.cameraManager.createCamera({
    nvrId: nvr.id,
    label: "Local primary",
    channelKey: "7",
    streamProfile: "main",
    enabled: true,
  })
  const fallback = await stack.cameraManager.createCamera({
    nvrId: nvr.id,
    label: "Local fallback",
    channelKey: "8",
    streamProfile: "main",
    enabled: true,
  })
  const resourceId = stack.edgeConfigV2.resources[0].resourceId
  stack.mappingManager.putResourcePolicy(resourceId, {
    selectionMode: "automatic",
    candidates: [
      { cameraId: primary.id, priority: 1, captureModes: ["edge_buffer"], enabled: true },
      { cameraId: fallback.id, priority: 2, captureModes: ["edge_buffer"], enabled: true },
    ],
  })

  const runtime = resolveRuntimeEdgeConfigV2(
    stack.repositories,
    stack.edgeConfigV2,
  )

  assert.deepEqual(
    runtime.resourcePolicies[0].candidates.map((candidate) => candidate.sourceId),
    [primary.id, fallback.id],
  )
  assert.deepEqual(
    runtime.sources.map((source) => source.channelKey).sort(),
    ["7", "8"],
  )
})
