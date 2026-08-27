import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { rotateDeviceCredentialsWithOverlap } from "../src/auth/credential-rotation.ts"
import { CredentialManager } from "../src/auth/credential-manager.ts"
import {
  MemorySecretStore,
} from "../src/auth/secret-store.ts"
import {
  collectRedactedDiagnostics,
  diagnosticsContainForbiddenMaterial,
} from "../src/health/diagnostics.ts"
import { redactSecrets } from "../src/health/metrics.ts"

test("memory secret store round-trips without plaintext secret files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-secret-"))
  const manager = new CredentialManager(
    join(dir, "installation.json"),
    join(dir, "credentials.dpapi"),
    "memory",
    "simulate",
  )

  await manager.persistCredentials({
    deviceId: "device-1",
    secret: "device-secret-value",
    credentialVersion: 1,
  })

  const loaded = await manager.loadCredentials()
  assert.deepEqual(loaded, {
    deviceId: "device-1",
    secret: "device-secret-value",
    credentialVersion: 1,
  })

  const installation = await readFile(join(dir, "installation.json"), "utf8")
  assert.ok(!installation.includes("device-secret-value"))

  await manager.wipeAfterRevoke()
  assert.equal(await manager.loadCredentials(), null)
  const revokedMeta = JSON.parse(
    await readFile(join(dir, "installation.json"), "utf8"),
  )
  assert.ok(revokedMeta.revokedAt)
})

test("protected store fails closed when backend cannot persist", async () => {
  class FailingStore extends MemorySecretStore {
    async set() {
      throw new Error("dpapi unavailable")
    }
  }

  const store = new FailingStore()
  await assert.rejects(() => store.set({ secret: "secret-value" }), /dpapi unavailable/)
})

test("credential rotation persists before acknowledgement and rolls back on failure", async () => {
  const dir = await mkdtemp(join(tmpdir(), "venue-edge-rotate-"))
  const manager = new CredentialManager(
    join(dir, "installation.json"),
    join(dir, "credentials.dpapi"),
    "memory",
    "simulate",
  )

  await manager.persistCredentials({
    deviceId: "device-rotate",
    secret: "old-secret",
    credentialVersion: 1,
  })

  const calls = []
  const client = {
    rotateCredential: async () => ({
      secret: "new-secret",
      credentialVersion: 2,
      previousVersion: 1,
    }),
    setCredentials: (credentials) => {
      calls.push(`set:${credentials.secret}`)
    },
    acknowledgeCredentialRotation: async () => {
      calls.push("ack")
      return { credentialVersion: 2, previousVersion: 1 }
    },
    rollbackCredentialRotation: async () => {
      calls.push("rollback")
      return { credentialVersion: 1, rolledBackVersion: 2 }
    },
  }

  const result = await rotateDeviceCredentialsWithOverlap({
    client,
    credentialManager: manager,
  })

  assert.equal(result.credentialVersion, 2)
  assert.deepEqual(calls, ["set:new-secret", "ack"])

  const reloaded = await manager.loadCredentials()
  assert.equal(reloaded?.secret, "new-secret")
  assert.equal(reloaded?.credentialVersion, 2)

  class FailingManager extends CredentialManager {
    async persistCredentials(credentials) {
      if (credentials.secret === "new-secret") {
        throw new Error("persist failed")
      }
      return super.persistCredentials(credentials)
    }
  }

  const failing = new FailingManager(
    join(dir, "installation-fail.json"),
    join(dir, "credentials-fail.dpapi"),
    "memory",
    "simulate",
  )
  await failing.persistCredentials({
    deviceId: "device-rotate",
    secret: "old-secret",
    credentialVersion: 1,
  })

  const rollbackCalls = []
  const rollbackClient = {
    rotateCredential: async () => ({
      secret: "new-secret",
      credentialVersion: 2,
      previousVersion: 1,
    }),
    setCredentials: (credentials) => {
      rollbackCalls.push(`set:${credentials.secret}`)
    },
    acknowledgeCredentialRotation: async () => {
      rollbackCalls.push("ack")
      return { credentialVersion: 2, previousVersion: 1 }
    },
    rollbackCredentialRotation: async () => {
      rollbackCalls.push("rollback")
      return { credentialVersion: 1, rolledBackVersion: 2 }
    },
  }

  await assert.rejects(
    () =>
      rotateDeviceCredentialsWithOverlap({
        client: rollbackClient,
        credentialManager: failing,
      }),
  )

  assert.deepEqual(rollbackCalls, ["set:old-secret", "rollback"])
})

test("diagnostics redact pairing codes, device auth headers, and upload grants", () => {
  const pairingCode = "ABCD-EFGHJK"
  const secret = "super-secret-value"
  const uploadUrl =
    "https://bucket.example/upload?X-Amz-Signature=abc123&X-Amz-Credential=foo"

  const redacted = collectRedactedDiagnostics({
    pairingCode,
    Authorization: `Device 11111111-1111-1111-1111-111111111111 ${secret}`,
    uploadGrant: { url: uploadUrl },
    camera: { label: "table-1" },
  })

  const serialized = JSON.stringify(redacted)
  assert.ok(!serialized.includes(secret))
  assert.ok(!serialized.includes(pairingCode))
  assert.ok(!serialized.includes("X-Amz-Signature"))
  assert.equal(
    diagnosticsContainForbiddenMaterial(redacted, [secret, pairingCode]),
    false,
  )

  const stringRedacted = redactSecrets(
    `pairing ${pairingCode} auth Device 11111111-1111-1111-1111-111111111111 ${secret}`,
  )
  assert.ok(!String(stringRedacted).includes(secret))
  assert.ok(!String(stringRedacted).includes(pairingCode))
})
