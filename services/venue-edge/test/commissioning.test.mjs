import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { writeFileSync, readFileSync } from "node:fs"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { CredentialManager } from "../src/auth/credential-manager.ts"
import { createNvrPasswordStore } from "../src/auth/nvr-secret-store.ts"
import { CommandProcessor } from "../src/commands/processor.ts"
import {
  checksumEdgeConfigSnapshot,
  formatEdgeConfigChecksum,
} from "../src/cloud/config-v2-checksum.ts"
import { parseEdgeConfigV2 } from "../src/cloud/config-v2.ts"
import { createLocalStoragePaths } from "../src/local-storage/paths.ts"
import { EdgeRepositories } from "../src/local-storage/repositories.ts"
import { initDatabase } from "../src/state/sqlite.ts"
import {
  CommissioningError,
  CommissioningManager,
} from "../src/setup/commissioning-manager.ts"
import { LocalCameraManager } from "../src/setup/local-camera-manager.ts"
import { LocalNvrManager } from "../src/setup/local-nvr-manager.ts"
import { LocalResourceMappingManager } from "../src/setup/local-resource-mapping-manager.ts"
import { startSetupHost, stopSetupHost } from "../src/setup/host.ts"
import { loadEnv } from "../src/config/env.ts"

const fixturesRoot = join(import.meta.dirname, "..", "fixtures")

function loadFixture(name) {
  return JSON.parse(
    readFileSync(join(fixturesRoot, name), "utf8"),
  )
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

function createProbeScenario(code) {
  return {
    async run() {
      const checks = [
        {
          check: "reachability",
          passed: code !== "nvr_unreachable",
          code: code === "nvr_unreachable" ? "nvr_unreachable" : undefined,
          message:
            code === "nvr_unreachable"
              ? "Unreachable — check LAN IP, routing, and firewall rules."
              : "NVR TCP port is reachable.",
        },
      ]

      if (code === "nvr_unreachable") {
        return { passed: false, timeMode: "unknown", checks }
      }

      if (code === "source_auth_failed") {
        checks.push({
          check: "authentication",
          passed: false,
          code: "source_auth_failed",
          message: "Authentication failed.",
        })
        return { passed: false, timeMode: "unknown", checks }
      }

      if (code === "codec_incompatible") {
        checks.push(
          { check: "authentication", passed: true, message: "ok" },
          { check: "live_rtsp", passed: true, message: "ok" },
          {
            check: "codec",
            passed: false,
            code: "codec_incompatible",
            message: "Unsupported codec.",
          },
        )
        return { passed: false, timeMode: "unknown", checks }
      }

      if (code === "channel_unavailable") {
        checks.push(
          { check: "authentication", passed: true, message: "ok" },
          {
            check: "live_rtsp",
            passed: false,
            code: "channel_unavailable",
            message: "Channel unavailable.",
          },
        )
        return { passed: false, timeMode: "unknown", checks }
      }

      if (code === "clock_skew") {
        checks.push(
          { check: "authentication", passed: true, message: "ok" },
          { check: "live_rtsp", passed: true, message: "ok" },
          { check: "codec", passed: true, message: "ok" },
          {
            check: "clock_skew",
            passed: false,
            code: "clock_skew",
            message: "Clock skew 120s — sync NTP on the NVR.",
          },
        )
        return { passed: false, timeMode: "z", checks }
      }

      return {
        passed: true,
        timeMode: "z",
        checks: [
          { check: "reachability", passed: true, message: "ok" },
          { check: "authentication", passed: true, message: "ok" },
          { check: "live_rtsp", passed: true, message: "ok" },
          { check: "codec", passed: true, message: "ok" },
          { check: "clock_skew", passed: true, message: "ok" },
        ],
      }
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

async function createCommissioningStack(options = {}) {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-commissioning-"))
  const database = initDatabase(join(dir, "venue-edge.sqlite"))
  const repositories = new EdgeRepositories(database.db)
  const passwordStore = createNvrPasswordStore({
    dataDir: dir,
    secretStoreMode: "memory",
    venueMode: options.mode ?? "simulate",
  })
  const nvrManager = new LocalNvrManager(repositories, passwordStore)
  const cameraManager = new LocalCameraManager(
    repositories,
    passwordStore,
    nvrManager,
  )
  const credentialManager = new CredentialManager(
    join(dir, "installation.json"),
    join(dir, "credentials.dpapi"),
    "memory",
    options.mode ?? "simulate",
  )
  const paths = createLocalStoragePaths({
    ...loadEnv(),
    dataDir: dir,
  })

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

  const commissioningManager = new CommissioningManager(
    repositories,
    passwordStore,
    cameraManager,
    paths,
    credentialManager,
    () => edgeConfigV2,
    options.client ?? undefined,
    options.probeRunner,
    options.previewClipRunner,
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
    paths,
    commissioningManager,
    edgeConfigV2,
  }
}

async function seedTwoCameraResource(stack) {
  const { nvrManager, cameraManager, mappingManager, edgeConfigV2 } = stack
  const resourceId = edgeConfigV2.resources[0].resourceId

  const nvr1 = await nvrManager.createNvr({
    label: "NVR A",
    vendor: "vigi",
    host: "192.168.10.1",
    rtspPort: 554,
    username: "playtt_edge",
    password: "secret-a",
    testChannelKey: "1",
  })
  const nvr2 = await nvrManager.createNvr({
    label: "NVR B",
    vendor: "vigi",
    host: "192.168.10.2",
    rtspPort: 554,
    username: "playtt_edge",
    password: "secret-b",
    testChannelKey: "1",
  })

  const camera1 = await cameraManager.createCamera({
    nvrId: nvr1.id,
    channelKey: "1",
    streamProfile: "main",
    label: "Camera A",
  })
  const camera2 = await cameraManager.createCamera({
    nvrId: nvr2.id,
    channelKey: "2",
    streamProfile: "main",
    label: "Camera B",
  })

  await cameraManager.updateCamera(camera1.id, { enabled: true })
  await cameraManager.updateCamera(camera2.id, { enabled: true })

  await mappingManager.putResourcePolicy(resourceId, {
    selectionMode: "automatic",
    autoFailback: true,
    failureThreshold: 3,
    cooldownSeconds: 60,
    healthyThreshold: 2,
    candidates: [
      {
        cameraId: camera1.id,
        priority: 1,
        captureModes: ["edge_buffer"],
        enabled: true,
      },
      {
        cameraId: camera2.id,
        priority: 2,
        captureModes: ["edge_buffer"],
        enabled: true,
      },
    ],
  })

  return { resourceId, camera1, camera2 }
}

test("enabled camera tests return distinct remediation codes", async () => {
  const codes = [
    "source_auth_failed",
    "nvr_unreachable",
    "codec_incompatible",
    "channel_unavailable",
    "clock_skew",
  ]

  for (const code of codes) {
    const stack = await createCommissioningStack({
      probeRunner: createProbeScenario(code),
    })
    const nvr = await stack.nvrManager.createNvr({
      label: `NVR ${code}`,
      vendor: "vigi",
      host: "192.168.10.50",
      rtspPort: 554,
      username: "playtt_edge",
      password: "secret-value",
      testChannelKey: "1",
    })
    const camera = await stack.cameraManager.createCamera({
      nvrId: nvr.id,
      channelKey: "1",
      streamProfile: "main",
    })
    await stack.cameraManager.updateCamera(camera.id, { enabled: true })

    const result = await stack.commissioningManager.testCamera(camera.id)
    assert.equal(result?.passed, false)
    const found = result?.result.checks.some((check) => check.code === code)
    assert.equal(found, true, `expected code ${code}`)

    stack.database.close()
  }
})

test("15s preview writes file and JSON omits RTSP userinfo; token required for MP4", async () => {
  const stack = await createCommissioningStack({
    previewClipRunner: {
      async extractClip({ outputPath }) {
        writeFileSync(outputPath, "fake-mp4-bytes")
      },
    },
  })

  const nvr = await stack.nvrManager.createNvr({
    label: "Preview NVR",
    vendor: "vigi",
    host: "192.168.10.60",
    rtspPort: 554,
    username: "playtt_edge",
    password: "preview-secret",
    testChannelKey: "1",
  })
  const camera = await stack.cameraManager.createCamera({
    nvrId: nvr.id,
    channelKey: "1",
    streamProfile: "main",
  })
  await stack.cameraManager.updateCamera(camera.id, { enabled: true })

  const host = await startSetupHost({
    port: 0,
    sessionTtlMs: 60_000,
    credentialManager: stack.credentialManager,
    localNvrManager: stack.nvrManager,
    localCameraManager: stack.cameraManager,
    localResourceMappingManager: stack.mappingManager,
    commissioningManager: stack.commissioningManager,
  })

  const fetchWithToken = setupFetch(host.port, host.session.token)

  const preview = await fetchWithToken(
    `/api/setup/cameras/${camera.id}/preview`,
    { method: "POST", body: "{}" },
  )
  const previewBody = await preview.json()
  assert.equal(previewBody.durationSeconds, 15)
  assert.equal(previewBody.available, true)
  assert.equal("path" in previewBody, false)
  const serialized = JSON.stringify(previewBody)
  assert.doesNotMatch(serialized, /preview-secret/i)
  assert.doesNotMatch(serialized, /rtsp:/i)

  const withoutToken = await fetch(
    `http://127.0.0.1:${host.port}/api/setup/cameras/${camera.id}/preview.mp4`,
    { headers: { Host: `127.0.0.1:${host.port}` } },
  )
  assert.equal(withoutToken.status, 401)

  const withToken = await fetch(
    `http://127.0.0.1:${host.port}/api/setup/cameras/${camera.id}/preview.mp4?setup_token=${encodeURIComponent(host.session.token)}`,
    { headers: { Host: `127.0.0.1:${host.port}` } },
  )
  assert.equal(withToken.status, 200)
  assert.match(withToken.headers.get("content-type") ?? "", /video\/mp4/)

  await stopSetupHost(host)
  stack.database.close()
})

test("failover drill selects fallback camera", async () => {
  const stack = await createCommissioningStack({
    fixture: "edge-v2-cross-nvr-failover.json",
    probeRunner: createProbeScenario("ok"),
  })

  const { resourceId, camera1, camera2 } = await seedTwoCameraResource(stack)

  const result = await stack.commissioningManager.runFailoverDrill(resourceId)
  assert.equal(result.passed, true)
  assert.equal(result.primaryCameraId, camera1.id)
  assert.equal(result.selectedCameraId, camera2.id)
  assert.equal(result.selectionReason, "failover")

  const restored = stack.repositories.getSourceHealthBySourceId(camera1.id)
  assert.notEqual(restored?.status, "unhealthy")

  stack.database.close()
})

test("promote fallback via policy PUT does not clear other resource routes", async () => {
  const stack = await createCommissioningStack({
    fixture: "edge-v2-cross-nvr-failover.json",
    probeRunner: createProbeScenario("ok"),
  })

  const { resourceId, camera1, camera2 } = await seedTwoCameraResource(stack)

  stack.mappingManager.putResourcePolicy(resourceId, {
    selectionMode: "manual",
    autoFailback: false,
    failureThreshold: 3,
    cooldownSeconds: 60,
    healthyThreshold: 2,
    candidates: [
      {
        cameraId: camera2.id,
        priority: 1,
        captureModes: ["edge_buffer"],
        enabled: true,
      },
      {
        cameraId: camera1.id,
        priority: 2,
        captureModes: ["edge_buffer"],
        enabled: true,
      },
    ],
  })

  const routes = stack.repositories.listLocalResourceRoutes(resourceId)
  assert.equal(routes.length, 2)
  assert.equal(routes[0].cameraId, camera2.id)

  stack.database.close()
})

test("complete refused until checklist passes", async () => {
  const stack = await createCommissioningStack({
    fixture: "edge-v2-cross-nvr-failover.json",
  })

  await assert.rejects(
    () => stack.commissioningManager.complete(false),
    (error) =>
      error instanceof CommissioningError &&
      error.code === "checklist_incomplete",
  )

  stack.database.close()
})

test("unpaired publish returns 409 through setup host", async () => {
  const stack = await createCommissioningStack({
    client: {
      async publishCommissioning() {
        return { publishedAt: new Date().toISOString() }
      },
    },
  })

  const host = await startSetupHost({
    port: 0,
    sessionTtlMs: 60_000,
    credentialManager: stack.credentialManager,
    commissioningManager: stack.commissioningManager,
  })

  const response = await setupFetch(host.port, host.session.token)(
    "/api/setup/commissioning/publish",
    { method: "POST", body: "{}" },
  )
  assert.equal(response.status, 409)

  await stopSetupHost(host)
  stack.database.close()
})

test("publish payload builder omits password fields", async () => {
  const stack = await createCommissioningStack()
  const nvr = await stack.nvrManager.createNvr({
    label: "Audit NVR",
    vendor: "vigi",
    host: "192.168.10.70",
    rtspPort: 554,
    username: "playtt_edge",
    password: "never-publish-this",
    testChannelKey: "1",
  })
  await stack.cameraManager.createCamera({
    nvrId: nvr.id,
    channelKey: "1",
    streamProfile: "main",
  })

  const payload = stack.commissioningManager.buildRedactedPublishPayload(false)
  const serialized = JSON.stringify(payload)
  assert.doesNotMatch(serialized, /never-publish-this/i)
  assert.doesNotMatch(serialized, /password/i)

  stack.database.close()
})

test("production capture rejected until commissioning complete", async () => {
  const stack = await createCommissioningStack({ mode: "production" })

  const ackCalls = []
  const processor = new CommandProcessor(
    {
      async acknowledgeCommand(commandId, input) {
        ackCalls.push({ commandId, input })
        return { id: commandId }
      },
    },
    stack.repositories,
    {
      async processCaptureReplay() {
        return true
      },
    },
    () => null,
    () => null,
    () => stack.repositories.getCommissioningState().completed,
  )

  const command = {
    id: randomUUID(),
    kind: "capture_replay",
    payload: {
      replayRequestId: randomUUID(),
      replayId: randomUUID(),
      mediaAssetId: randomUUID(),
      objectKey: "clips/test.mp4",
      captureAt: new Date().toISOString(),
      preRollSeconds: 5,
      postRollSeconds: 5,
      sourceType: "edge_buffer",
      resourceId: randomUUID(),
      configRevisionId: randomUUID(),
      playSessionId: randomUUID(),
      uploadGrant: {
        url: "https://example.com/upload",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    correlationId: "commissioning-gate",
    attemptCount: 1,
  }

  stack.repositories.upsertCommand({
    id: command.id,
    kind: command.kind,
    payload: command.payload,
    correlationId: command.correlationId,
    expiresAt: command.expiresAt,
    attemptCount: command.attemptCount,
  })

  const rejected = await processor.handleCommand(command)
  assert.equal(rejected, false)
  assert.equal(ackCalls.length, 1)
  assert.equal(
    ackCalls[0].input.result?.reason,
    "commissioning_incomplete",
  )

  stack.database.close()
})

test("restart preserves commissioning completed flag", async () => {
  const stack = await createCommissioningStack()
  stack.repositories.updateCommissioningState({
    completed: true,
    completedAt: new Date().toISOString(),
    failoverReady: true,
    publishedAt: new Date().toISOString(),
  })

  const sqlitePath = join(stack.dir, "venue-edge.sqlite")
  stack.database.close()

  const reopened = initDatabase(sqlitePath)
  const repositories = new EdgeRepositories(reopened.db)
  const state = repositories.getCommissioningState()
  assert.equal(state.completed, true)
  assert.notEqual(state.completedAt, null)

  reopened.close()
})

test("topology changes invalidate completed commissioning", async () => {
  const stack = await createCommissioningStack({ fixture: "edge-v2-one-nvr.json" })
  stack.repositories.updateCommissioningState({
    completed: true,
    completedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    failoverReady: true,
  })

  await stack.nvrManager.createNvr({
    label: "Replacement NVR",
    vendor: "vigi",
    host: "192.168.10.30",
    rtspPort: 554,
    username: "playtt_edge",
    password: "protected-secret",
    testChannelKey: "1",
  })

  const state = stack.repositories.getCommissioningState()
  assert.equal(state.completed, false)
  assert.equal(state.completedAt, null)
  assert.equal(state.publishedAt, null)
  assert.equal(state.failoverReady, false)
})
