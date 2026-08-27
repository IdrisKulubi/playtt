import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { CredentialManager } from "../src/auth/credential-manager.ts"
import { createNvrPasswordStore } from "../src/auth/nvr-secret-store.ts"
import { loadEnv } from "../src/config/env.ts"
import { EdgeRepositories } from "../src/local-storage/repositories.ts"
import { initDatabase } from "../src/state/sqlite.ts"
import { LocalNvrManager } from "../src/setup/local-nvr-manager.ts"
import { startSetupHost, stopSetupHost } from "../src/setup/host.ts"

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
          message: "Authentication failed — verify the dedicated NVR username and password.",
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
            message: "Unsupported codec — PlayTT requires H.264 for v1 capture.",
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
          { check: "playback", passed: true, message: "ok" },
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
          { check: "playback", passed: true, message: "ok" },
        ],
      }
    },
  }
}

async function createTestStack(probeRunner) {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-nvr-"))
  const database = initDatabase(join(dir, "venue-edge.sqlite"))
  const repositories = new EdgeRepositories(database.db)
  const passwordStore = createNvrPasswordStore({
    dataDir: dir,
    secretStoreMode: "memory",
    venueMode: "simulate",
  })
  const manager = new LocalNvrManager(
    repositories,
    passwordStore,
    probeRunner,
  )
  const credentialManager = new CredentialManager(
    join(dir, "installation.json"),
    join(dir, "credentials.dpapi"),
    "memory",
    "simulate",
  )

  return { dir, database, repositories, passwordStore, manager, credentialManager }
}

test("local NVR CRUD persists metadata and protected passwords across sqlite reopen", async () => {
  const { dir, database, repositories, passwordStore } =
    await createTestStack()

  const manager = new LocalNvrManager(repositories, passwordStore)
  const created = await manager.createNvr({
    label: "North NVR",
    vendor: "vigi",
    host: "192.168.10.20",
    rtspPort: 554,
    username: "playtt_edge",
    password: "secret-password-value",
    testChannelKey: "1",
  })

  assert.match(created.localConnectionKey, /^windows-dpapi:nvr-/)
  assert.equal(created.hasPassword, true)

  database.close()

  const reopened = initDatabase(join(dir, "venue-edge.sqlite"))
  const reopenedManager = new LocalNvrManager(
    new EdgeRepositories(reopened.db),
    passwordStore,
  )
  const listed = await reopenedManager.listPublicNvrs()
  assert.equal(listed.length, 1)
  assert.equal(listed[0].label, "North NVR")
  assert.equal(listed[0].hasPassword, true)

  const updated = await reopenedManager.updateNvr(created.id, {
    label: "North NVR renamed",
    enabled: false,
  })
  assert.equal(updated?.enabled, false)

  const deleted = await reopenedManager.deleteNvr(created.id)
  assert.equal(deleted, true)
  assert.equal((await reopenedManager.listPublicNvrs()).length, 0)

  reopened.close()
})

test("setup NVR APIs omit passwords and require setup token", async () => {
  const { manager, credentialManager } = await createTestStack()
  const host = await startSetupHost({
    port: 0,
    sessionTtlMs: 60_000,
    credentialManager,
    localNvrManager: manager,
  })

  const port = host.port
  const token = host.session.token
  const fetchSetup = setupFetch(port, token)

  const missing = await fetch(`http://127.0.0.1:${port}/api/setup/nvrs`, {
    headers: { Host: `127.0.0.1:${port}` },
  })
  assert.equal(missing.status, 401)

  const created = await fetchSetup("/api/setup/nvrs", {
    method: "POST",
    body: JSON.stringify({
      label: "South NVR",
      vendor: "vigi",
      host: "192.168.10.21",
      rtspPort: 554,
      username: "playtt_edge",
      password: "ABCD-EFGHJK",
      testChannelKey: "2",
    }),
  })
  assert.equal(created.status, 201)
  const createdBody = await created.json()
  const serialized = JSON.stringify(createdBody)
  assert.doesNotMatch(serialized, /ABCD-EFGHJK/)
  assert.doesNotMatch(serialized, /secret-password/i)
  assert.equal(createdBody.nvr.hasPassword, true)

  const listed = await (await fetchSetup("/api/setup/nvrs")).json()
  assert.equal(listed.nvrs.length, 1)
  assert.equal(listed.nvrs[0].hasPassword, true)

  await stopSetupHost(host)
})

test("probe scenarios return distinct remediation codes", async () => {
  for (const code of [
    "nvr_unreachable",
    "source_auth_failed",
    "codec_incompatible",
    "clock_skew",
  ]) {
    const { manager } = await createTestStack(createProbeScenario(code))
    const created = await manager.createNvr({
      label: `NVR ${code}`,
      vendor: "vigi",
      host: "192.168.10.30",
      rtspPort: 554,
      username: "playtt_edge",
      password: "probe-secret",
      testChannelKey: "1",
    })

    const tested = await manager.testNvr(created.id)
    assert.ok(tested)
    const failing = tested.result.checks.find((check) => !check.passed)
    assert.equal(failing?.code, code)
  }
})

test("three local NVRs can be stored and listed", async () => {
  const { manager } = await createTestStack()
  for (let index = 1; index <= 3; index += 1) {
    await manager.createNvr({
      label: `NVR ${index}`,
      vendor: "vigi",
      host: `192.168.10.${index}`,
      rtspPort: 554,
      username: "playtt_edge",
      password: `password-${index}`,
      testChannelKey: String(index),
    })
  }

  const listed = await manager.listPublicNvrs()
  assert.equal(listed.length, 3)
})

test("runtime RTSP map resolves from local connection key", async () => {
  const { manager } = await createTestStack()
  const created = await manager.createNvr({
    label: "Runtime NVR",
    vendor: "vigi",
    host: "192.168.10.40",
    rtspPort: 554,
    username: "playtt_edge",
    password: "runtime-secret",
    testChannelKey: "1",
  })

  const recorderId = randomUUID()
  const sourceId = randomUUID()

  const edgeConfigV2 = {
    protocolVersion: "edge-v2",
    configRevision: {
      id: randomUUID(),
      version: 1,
      checksum: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      publishedAt: new Date().toISOString(),
    },
    installation: {
      id: randomUUID(),
      deviceId: randomUUID(),
      tenantId: randomUUID(),
      venueId: randomUUID(),
      minimumAgentVersion: "0.1.0",
    },
    resources: [],
    recorders: [
      {
        id: recorderId,
        label: "Runtime NVR",
        vendor: "vigi",
        enabled: true,
        connection: { host: "192.168.10.40", rtspPort: 554 },
        localConnectionKey: created.localConnectionKey,
      },
    ],
    sources: [
      {
        id: sourceId,
        recorderId,
        label: "Table 1",
        channelKey: "3",
        streamProfile: "main",
        codec: "h264",
        enabled: true,
      },
    ],
    resourcePolicies: [],
  }

  const env = loadEnv({ sourceRtspUrls: {}, runtimeSourceRtspUrls: {} })
  const map = await manager.buildRuntimeSourceRtspMap(edgeConfigV2)
  env.runtimeSourceRtspUrls = map

  assert.match(map[sourceId], /^rtsp:\/\/playtt_edge:/)
  assert.match(map[sourceId], /192\.168\.10\.40:554\/live\/3\/1\/avm/)
})
