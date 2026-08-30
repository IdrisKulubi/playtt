import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { CredentialManager } from "../src/auth/credential-manager.ts"
import { EdgeV1Client } from "../src/cloud/client.ts"
import { enrollVenueEdge } from "../src/enrollment/enroll.ts"

function jsonResponse(status, data) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "content-type": "application/json" },
  })
}

test("enroll exchanges pairing code, persists without plaintext secret, heartbeats, then confirms", async () => {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-enroll-"))
  const manager = new CredentialManager(
    join(dir, "installation.json"),
    join(dir, "credentials.dpapi"),
    "memory",
    "simulate",
  )

  const pairingCode = "ABCD-EFGHJK"
  const secret = "device-secret-value-xyz"
  const deviceId = randomUUID()
  const installationId = randomUUID()
  const calls = []

  const fetchImpl = async (url, init) => {
    const path = String(url)
    const body = init?.body ? JSON.parse(String(init.body)) : null
    calls.push({ path, method: init?.method, body, headers: init?.headers })

    if (path.endsWith("/api/edge/v1/enroll/exchange")) {
      return jsonResponse(201, {
        deviceId,
        secret,
        credentialVersion: 1,
        installationId,
        tenantId: randomUUID(),
        locationId: randomUUID(),
        status: "pending_setup",
      })
    }

    if (path.endsWith("/api/edge/v1/heartbeat")) {
      return jsonResponse(200, {
        health: "online",
        lastHeartbeatAt: new Date().toISOString(),
        sampled: true,
        pendingCommandCount: 0,
      })
    }

    if (path.endsWith("/api/edge/v1/enroll/confirm")) {
      return jsonResponse(200, {
        deviceId,
        status: "online",
        alreadyConfirmed: false,
      })
    }

    return new Response("not found", { status: 404 })
  }

  const client = new EdgeV1Client({
    baseUrl: "http://cloud.test",
    agentVersion: "0.1.0",
    fetchImpl,
  })

  const result = await enrollVenueEdge({
    pairingCode,
    credentialManager: manager,
    client,
    agentVersion: "0.1.0",
    bootId: "boot-enroll-1",
  })

  assert.equal(result.deviceId, deviceId)
  assert.equal(result.installationId, installationId)
  assert.equal(result.status, "online")
  assert.equal(calls[0].path.endsWith("/api/edge/v1/enroll/exchange"), true)
  assert.equal(calls[0].headers?.Authorization, undefined)
  assert.equal(calls[0].body.pairingCode, pairingCode)
  assert.match(calls[0].body.installationUid, /^[0-9a-f-]{36}$/i)
  assert.equal(calls[1].path.endsWith("/api/edge/v1/heartbeat"), true)
  assert.equal(calls[2].path.endsWith("/api/edge/v1/enroll/confirm"), true)
  assert.match(String(calls[1].headers.Authorization), /^Device /)

  const metadata = JSON.parse(
    await readFile(join(dir, "installation.json"), "utf8"),
  )
  assert.equal(metadata.deviceId, deviceId)
  assert.ok(!JSON.stringify(metadata).includes(secret))
  assert.ok(!JSON.stringify(metadata).includes(pairingCode))

  const stored = await manager.loadCredentials()
  assert.equal(stored?.secret, secret)
  assert.ok(stored?.installationUid)

  await assert.rejects(
    () =>
      enrollVenueEdge({
        pairingCode,
        credentialManager: manager,
        client,
        agentVersion: "0.1.0",
        bootId: "boot-enroll-2",
      }),
    /already enrolled/,
  )
})

test("pairing after missing secret mints a new installation uid", async () => {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-enroll-stale-"))
  const staleUid = randomUUID()
  await writeFile(
    join(dir, "installation.json"),
    `${JSON.stringify({ deviceId: randomUUID(), installationUid: staleUid })}\n`,
  )
  const manager = new CredentialManager(
    join(dir, "installation.json"),
    join(dir, "credentials.dpapi"),
    "memory",
    "simulate",
  )

  const deviceId = randomUUID()
  const installationId = randomUUID()
  const secret = "device-secret-value-xyz"
  let exchangedUid = null

  const fetchImpl = async (url, init) => {
    const path = String(url)
    const body = init?.body ? JSON.parse(String(init.body)) : null
    if (path.endsWith("/api/edge/v1/enroll/exchange")) {
      exchangedUid = body.installationUid
      return jsonResponse(201, {
        deviceId,
        secret,
        credentialVersion: 1,
        installationId,
        tenantId: randomUUID(),
        locationId: randomUUID(),
        status: "pending_setup",
      })
    }
    if (path.endsWith("/api/edge/v1/heartbeat")) {
      return jsonResponse(200, {
        health: "online",
        lastHeartbeatAt: new Date().toISOString(),
        sampled: false,
        pendingCommandCount: 0,
      })
    }
    if (path.endsWith("/api/edge/v1/enroll/confirm")) {
      return jsonResponse(200, {
        deviceId,
        status: "online",
        alreadyConfirmed: false,
      })
    }
    return new Response("not found", { status: 404 })
  }

  const client = new EdgeV1Client({
    baseUrl: "http://cloud.test",
    agentVersion: "0.1.0",
    fetchImpl,
  })

  await enrollVenueEdge({
    pairingCode: "9NJ8-ZQNM85",
    credentialManager: manager,
    client,
    agentVersion: "0.1.0",
    bootId: "boot-stale-1",
  })

  assert.ok(exchangedUid)
  assert.notEqual(exchangedUid, staleUid)
})
