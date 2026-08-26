import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import test from "node:test"

import {
  decryptCredentialSecret,
  encryptCredentialSecret,
  parseCredentialKeyring,
} from "./encryption.ts"
import { AccessProviderError } from "./errors.ts"
import {
  accessRetryDelaySeconds,
  modifyAccessGrant,
  provisionAccessGrant,
  revokeAccessGrant,
} from "./lifecycle-core.mjs"
import {
  buildProviderPasscodeName,
  fingerprintPasscode,
  generateBookingPasscode,
  resolveAccessWindow,
} from "./policy.mjs"
import { redactAccessValue } from "./redaction.mjs"
import { SimulatedRelayProvider } from "./relay-providers.ts"
import { SimulatedAccessProvider } from "./simulated-access-provider.ts"
import { exchangeTtlockPassword, TtlockAccessProvider } from "./ttlock-client.ts"

function keyring() {
  return {
    current: "v2",
    keys: new Map([
      ["v1", Buffer.alloc(32, 1)],
      ["v2", Buffer.alloc(32, 2)],
    ]),
  }
}

function target(overrides = {}) {
  return {
    credentialId: "credential-1",
    externalLockId: "lock-1",
    passcode: "12345678",
    passcodeName: "playtt:grant-1:credential-1",
    validFrom: new Date("2026-08-26T09:55:00.000Z"),
    validUntil: new Date("2026-08-26T11:05:00.000Z"),
    ...overrides,
  }
}

test("AES-GCM credential envelope binds ciphertext to its AAD and key version", () => {
  const encrypted = encryptCredentialSecret("12345678", "tenant:t1:grant:g1", keyring())
  assert.match(encrypted, /^v2\./)
  assert.equal(
    decryptCredentialSecret(encrypted, "tenant:t1:grant:g1", keyring()),
    "12345678",
  )
  assert.throws(() => decryptCredentialSecret(encrypted, "tenant:t2:grant:g1", keyring()))
})

test("credential keyring rejects missing and short keys", () => {
  assert.throws(() => parseCredentialKeyring(""), /not configured/)
  assert.throws(
    () =>
      parseCredentialKeyring(
        JSON.stringify({ current: "v1", keys: { v1: Buffer.alloc(16).toString("base64") } }),
      ),
    /32 bytes/,
  )
})

test("access policy produces an eight-digit code and five-minute default window", () => {
  assert.equal(generateBookingPasscode(() => 10_000_001), "10000001")
  assert.equal(buildProviderPasscodeName("grant-1", "credential-1"), "playtt:grant-1:credential-1")
  assert.equal(fingerprintPasscode("12345678", "fingerprint-key").length, 64)

  const window = resolveAccessWindow({
    startTime: "2026-08-26T10:00:00.000Z",
    endTime: "2026-08-26T11:00:00.000Z",
  })
  assert.equal(window.validFrom.toISOString(), "2026-08-26T09:55:00.000Z")
  assert.equal(window.validUntil.toISOString(), "2026-08-26T11:05:00.000Z")
})

test("access redaction removes keyed secrets and embedded eight-digit codes", () => {
  const redacted = redactAccessValue({
    accessToken: "token-value",
    nested: { keyboardPwd: "12345678", message: "code 87654321 failed" },
  })
  assert.deepEqual(redacted, {
    accessToken: "[REDACTED]",
    nested: { keyboardPwd: "[REDACTED]", message: "code [REDACTED_CODE] failed" },
  })
})

test("simulator recovers an ambiguous provision without creating a duplicate", async () => {
  const provider = new SimulatedAccessProvider("lost_response_once")
  await assert.rejects(() => provider.provision(target()), AccessProviderError)
  const recovered = await provider.provision(target())
  assert.equal(recovered.externalCredentialId, "sim:credential-1")
  assert.equal((await provider.query("lock-1", target().passcodeName))?.status, "active")
})

test("simulator classifies provider failure scenarios", async () => {
  for (const [scenario, kind] of [
    ["collision", "collision"],
    ["timeout", "retryable"],
    ["rate_limited", "rate_limited"],
    ["token_expired", "authentication_refreshable"],
    ["gateway_offline", "offline"],
    ["unsupported_lock", "configuration_terminal"],
  ]) {
    const provider = new SimulatedAccessProvider(scenario)
    await assert.rejects(
      () => provider.provision(target({ passcodeName: `playtt:${scenario}:1` })),
      (error) => error instanceof AccessProviderError && error.kind === kind,
    )
  }
})

test("TTLock adapter sends gateway-mode form requests and hides tokens from errors", async () => {
  const requests = []
  const fetchImpl = async (url, init) => {
    requests.push({ url, init, body: new URLSearchParams(init.body) })
    if (String(url).endsWith("/v3/lock/listKeyboardPwd")) {
      return Response.json({ list: [] })
    }
    return Response.json({ keyboardPwdId: 42 })
  }
  const provider = new TtlockAccessProvider({
    token: async () => ({ clientId: "client-id", accessToken: "top-secret-token" }),
    fetchImpl,
    now: () => 1_777_777_777_777,
  })

  const provisioned = await provider.provision(target())
  assert.equal(provisioned.externalCredentialId, "42")
  const addRequest = requests.find((request) => request.url.endsWith("/keyboardPwd/add"))
  assert.equal(addRequest.body.get("addType"), "2")
  assert.equal(addRequest.body.get("keyboardPwd"), "12345678")
  assert.equal(addRequest.init.headers["content-type"], "application/x-www-form-urlencoded")
})

test("TTLock adapter rejects non-allowlisted endpoints", () => {
  assert.throws(
    () =>
      new TtlockAccessProvider({
        baseUrl: "https://attacker.example/",
        token: async () => ({ clientId: "client", accessToken: "token" }),
      }),
    /not allowlisted/,
  )
})

test("TTLock commissioning hashes the password before OAuth exchange", async () => {
  let submitted
  const token = await exchangeTtlockPassword({
    clientId: "client",
    clientSecret: "secret",
    username: "venue-account",
    password: "PlaintextPassword",
    fetchImpl: async (_url, init) => {
      submitted = new URLSearchParams(init.body)
      return Response.json({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
      })
    },
  })
  assert.equal(token.expiresInSeconds, 3600)
  assert.notEqual(submitted.get("password"), "PlaintextPassword")
  assert.match(submitted.get("password"), /^[a-f0-9]{32}$/)
})

test("relay simulator is idempotent and rejects expired work", async () => {
  const relay = new SimulatedRelayProvider()
  const input = {
    tenantId: "tenant-1",
    venueId: "venue-1",
    resourceId: "resource-1",
    playSessionId: "session-1",
    correlationId: "correlation-1",
    channel: "table_lights",
    desiredState: "on",
    expiresAt: new Date(Date.now() + 60_000),
    idempotencyKey: "relay:session-1:prepare:table_lights",
  }
  assert.deepEqual(await relay.execute(input), await relay.execute(input))
  await assert.rejects(
    () => relay.execute({ ...input, idempotencyKey: "expired", expiresAt: new Date(0) }),
    /expired/,
  )
})

function lifecycleFixture(provider) {
  const state = {
    grantStatus: "configuring",
    credentials: [
      {
        id: "credential-1",
        status: "pending",
        attemptCount: 0,
        maxAttempts: 3,
        externalLockId: "sim-lock-entrance",
        stableName: "playtt:grant-1:credential-1",
        externalCredentialId: null,
      },
    ],
  }
  const repository = {
    markCredentialProvisioning: async (credential) => {
      credential.status = "provisioning"
      credential.attemptCount += 1
    },
    markCredentialActive: async (credential, result) => {
      credential.status = "active"
      credential.externalCredentialId = result.externalCredentialId
    },
    markCredentialModifying: async (credential) => {
      credential.status = "modifying"
      credential.attemptCount += 1
    },
    markCredentialRetrying: async (credential) => {
      credential.status = "retrying"
    },
    markCredentialFailed: async (credential) => {
      credential.status = "failed"
    },
    markCredentialRevoked: async (credential) => {
      credential.status = "revoked"
    },
    listCredentials: async () => state.credentials,
    markGrantReady: async () => {
      state.grantStatus = "ready"
    },
    markGrantActionRequired: async () => {
      state.grantStatus = "action_required"
    },
    markGrantTemporarilyUnavailable: async () => {
      state.grantStatus = "temporarily_unavailable"
    },
    markGrantRevoking: async () => {
      state.grantStatus = "revoking"
    },
    markGrantRevoked: async () => {
      state.grantStatus = "revoked"
    },
  }
  return {
    state,
    credentials: state.credentials,
    repository,
    providerFor: async () => provider,
    grant: {
      id: "grant-1",
      status: "configuring",
      passcode: "12345678",
      validFrom: new Date("2026-08-26T09:55:00Z"),
      validUntil: new Date("2026-08-26T11:05:00Z"),
    },
  }
}

test("access lifecycle converges provision and revoke idempotently", async () => {
  const fixture = lifecycleFixture(new SimulatedAccessProvider())
  assert.equal(await provisionAccessGrant(fixture), "ready")
  assert.equal(await provisionAccessGrant(fixture), "ready")
  assert.equal(fixture.state.credentials[0].externalCredentialId, "sim:credential-1")
  assert.equal(await revokeAccessGrant(fixture), "revoked")
  assert.equal(await revokeAccessGrant(fixture), "revoked")
})

test("access lifecycle retains retryable failures without exposing the grant", async () => {
  const fixture = lifecycleFixture(new SimulatedAccessProvider("gateway_offline"))
  assert.equal(await provisionAccessGrant(fixture), "temporarily_unavailable")
  assert.equal(fixture.state.credentials[0].status, "retrying")
  assert.equal(accessRetryDelaySeconds(1), 15)
  assert.equal(accessRetryDelaySeconds(20), 3600)
})

test("access lifecycle modifies active credentials and keeps the grant ready", async () => {
  const fixture = lifecycleFixture(new SimulatedAccessProvider())
  assert.equal(await provisionAccessGrant(fixture), "ready")
  fixture.grant.validUntil = new Date("2026-08-26T12:05:00Z")
  fixture.credentials[0].status = "active"
  fixture.credentials[0].externalCredentialId = "sim:credential-1"
  assert.equal(await modifyAccessGrant(fixture), "ready")
  assert.equal(fixture.credentials[0].status, "active")
})

test("partial revoke only targets revoking credentials", async () => {
  const fixture = lifecycleFixture(new SimulatedAccessProvider())
  assert.equal(await provisionAccessGrant(fixture), "ready")
  fixture.credentials[0].status = "revoking"
  fixture.credentials[0].externalCredentialId = "sim:credential-1"
  assert.equal(
    await revokeAccessGrant({
      ...fixture,
      credentialFilter: (credential) => credential.status === "revoking",
    }),
    "revoked",
  )
})
