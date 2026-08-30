import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import http from "node:http"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { CredentialManager } from "../src/auth/credential-manager.ts"
import { EdgeProtocolError } from "../src/cloud/client.ts"
import { startSetupHost, stopSetupHost } from "../src/setup/host.ts"
import {
  createSetupSession,
  isSetupSessionActive,
  touchSetupSession,
} from "../src/setup/session.ts"

async function createCredentialManager() {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-setup-"))
  return new CredentialManager(
    join(dir, "installation.json"),
    join(dir, "credentials.dpapi"),
    "memory",
    "simulate",
  )
}

function setupFetch(port, token, overrides = {}) {
  return async (path, init = {}) => {
    const headers = new Headers(init.headers ?? {})
    if (!headers.has("X-VenueEdge-Setup-Token") && token) {
      headers.set("X-VenueEdge-Setup-Token", token)
    }
    if (!headers.has("Host")) {
      headers.set("Host", `127.0.0.1:${port}`)
    }

    return fetch(`http://127.0.0.1:${port}${path}`, {
      ...init,
      headers,
    })
  }
}

function rawSetupRequest(port, headers, path = "/api/setup/status") {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "GET",
        headers,
      },
      (res) => {
        const chunks = []
        res.on("data", (chunk) => chunks.push(chunk))
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        })
      },
    )
    req.on("error", reject)
    req.end()
  })
}

test("setup host binds to loopback only", async () => {
  const credentialManager = await createCredentialManager()
  const host = await startSetupHost({
    port: 0,
    sessionTtlMs: 60_000,
    credentialManager,
  })

  assert.equal(host.setupUrl.startsWith("http://127.0.0.1:"), true)

  await assert.rejects(
    () =>
      startSetupHost({
        port: 0,
        sessionTtlMs: 60_000,
        credentialManager,
        host: "0.0.0.0",
      }),
    /127\.0\.0\.1 only/,
  )

  await stopSetupHost(host)
})

test("setup wizard pairs through its protected local endpoint", async () => {
  const credentialManager = await createCredentialManager()
  const receivedCodes = []
  const host = await startSetupHost({
    port: 0,
    sessionTtlMs: 60_000,
    credentialManager,
    enroll: async (pairingCode) => {
      receivedCodes.push(pairingCode)
      return { status: "online" }
    },
  })
  const request = setupFetch(host.port, host.session.token)

  const response = await request("/api/setup/enroll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingCode: "ABCD-EFGHJK" }),
  })

  assert.equal(response.status, 200)
  assert.deepEqual(receivedCodes, ["ABCD-EFGHJK"])
  await stopSetupHost(host)
})

test("enroll surfaces cloud pairing errors instead of a generic 500", async () => {
  const credentialManager = await createCredentialManager()
  const host = await startSetupHost({
    port: 0,
    sessionTtlMs: 60_000,
    credentialManager,
    enroll: async () => {
      throw new EdgeProtocolError(
        "VALIDATION_ERROR",
        "Installation ID has already enrolled.",
        409,
      )
    },
  })
  const response = await setupFetch(host.port, host.session.token)(
    "/api/setup/enroll",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingCode: "9NJ8-ZQNM85" }),
    },
  )
  assert.equal(response.status, 409)
  const body = await response.json()
  assert.equal(body.error, "Installation ID has already enrolled.")
  await stopSetupHost(host)
})

test("missing, wrong, and expired setup tokens return 401", async () => {
  const credentialManager = await createCredentialManager()
  const host = await startSetupHost({
    port: 0,
    sessionTtlMs: 50,
    credentialManager,
  })

  const port = host.port
  const missing = await fetch(`http://127.0.0.1:${port}/api/setup/status`, {
    headers: { Host: `127.0.0.1:${port}` },
  })
  assert.equal(missing.status, 401)

  const wrong = await setupFetch(port, "not-the-token")(
    "/api/setup/status",
  )
  assert.equal(wrong.status, 401)

  await new Promise((resolve) => setTimeout(resolve, 60))

  const expired = await setupFetch(port, host.session.token)(
    "/api/setup/status",
  )
  assert.equal(expired.status, 401)

  await stopSetupHost(host)
})

test("bad Host and Origin are rejected for DNS rebinding protection", async () => {
  const credentialManager = await createCredentialManager()
  const host = await startSetupHost({
    port: 0,
    sessionTtlMs: 60_000,
    credentialManager,
  })

  const port = host.port
  const token = host.session.token

  const badHost = await rawSetupRequest(port, {
    Host: "evil.example:9999",
    "X-VenueEdge-Setup-Token": token,
  })
  assert.equal(badHost.status, 403)

  const badOrigin = await rawSetupRequest(port, {
    Host: `127.0.0.1:${port}`,
    Origin: "http://evil.example:9999",
    "X-VenueEdge-Setup-Token": token,
  })
  assert.equal(badOrigin.status, 403)

  const forwarded = await rawSetupRequest(port, {
    Host: `127.0.0.1:${port}`,
    "X-Forwarded-For": "203.0.113.1",
    "X-VenueEdge-Setup-Token": token,
  })
  assert.equal(forwarded.status, 403)

  await stopSetupHost(host)
})

test("locking setup does not stop the venue-edge agent", async () => {
  const credentialManager = await createCredentialManager()
  const host = await startSetupHost({
    port: 0,
    sessionTtlMs: 60_000,
    credentialManager,
  })

  let agentRunning = true
  const agentStop = () => {
    agentRunning = false
  }

  const port = host.port
  const response = await setupFetch(port, host.session.token)(
    "/api/setup/lock",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  )
  assert.equal(response.status, 200)

  host.lock()
  assert.equal(agentRunning, true)
  assert.equal(host.isLocked(), true)

  await stopSetupHost(host)
  assert.equal(agentRunning, true)
  agentStop()
  assert.equal(agentRunning, false)
})

test("setup status JSON omits secrets and pairing codes", async () => {
  const credentialManager = await createCredentialManager()
  const pairingCode = "ABCD-EFGHJK"
  const secret = "device-secret-value-xyz"

  await credentialManager.persistCredentials({
    deviceId: randomUUID(),
    secret,
    credentialVersion: 1,
  })

  const host = await startSetupHost({
    port: 0,
    sessionTtlMs: 60_000,
    credentialManager,
  })

  const port = host.port
  const response = await setupFetch(port, host.session.token)(
    "/api/setup/status",
  )
  assert.equal(response.status, 200)

  const body = await response.json()
  const serialized = JSON.stringify(body)

  assert.equal(body.enrollmentStatus, "enrolled")
  assert.equal(typeof body.setupLocked, "boolean")
  assert.ok(body.expiresAt)
  assert.doesNotMatch(serialized, /secret/i)
  assert.doesNotMatch(serialized, /ABCD-EFGHJK/)
  assert.ok(!serialized.includes(secret))

  await stopSetupHost(host)
})

test("setup session helper tracks expiry and lock state", () => {
  const session = createSetupSession(1_000)
  assert.equal(isSetupSessionActive(session), true)

  const locked = {
    ...session,
    locked: true,
  }
  assert.equal(isSetupSessionActive(locked), false)

  const expired = {
    ...session,
    expiresAt: new Date(Date.now() - 1),
  }
  assert.equal(isSetupSessionActive(expired), false)

  const touched = touchSetupSession(expired, 60_000)
  assert.equal(isSetupSessionActive(touched), true)
})

test("setup host serves redacted diagnostics support bundle", async () => {
  const credentialManager = await createCredentialManager()
  const host = await startSetupHost({
    port: 0,
    sessionTtlMs: 60_000,
    credentialManager,
    diagnostics: {
      env: {
        dataDir: ".",
        reservedFreeDiskBytes: 1_000_000,
        firmwareVersion: "0.2.0",
      },
      currentVersion: "0.2.0",
      platform: "win32",
      architecture: "x64",
      resolveInstallationId: async () => "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      getRecentFailureCodes: () => ["upload_failed"],
    },
  })

  const fetchSetup = setupFetch(host.port, host.session.token)
  const response = await fetchSetup("/api/setup/diagnostics/support-bundle")
  assert.equal(response.status, 200)

  const payload = await response.json()
  assert.equal(
    payload.bundle.installationId,
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  )
  assert.ok(Array.isArray(payload.bundle.recentFailureCodes))

  await stopSetupHost(host)
})
