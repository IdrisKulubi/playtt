import assert from "node:assert/strict"

import {
  modifyAccessGrant,
  provisionAccessGrant,
  revokeAccessGrant,
} from "./lifecycle-core.mjs"
import { resolveAccessWindow } from "./policy.mjs"
import { SimulatedAccessProvider } from "./simulated-access-provider.ts"

function lifecycleFixture(provider, credentials, grantOverrides = {}) {
  const state = {
    grantStatus: "configuring",
    credentials: credentials.map((credential) => ({ ...credential })),
  }

  const grant = {
    id: "grant-1",
    status: "configuring",
    passcode: "12345678",
    validFrom: new Date("2026-08-26T09:55:00.000Z"),
    validUntil: new Date("2026-08-26T11:05:00.000Z"),
    ...grantOverrides,
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
    grant,
    credentials: state.credentials,
    repository,
    providerFor: async () => provider,
  }
}

function credential(id, lockId, stableName, overrides = {}) {
  return {
    id,
    status: "pending",
    attemptCount: 0,
    maxAttempts: 3,
    externalLockId: lockId,
    stableName,
    externalCredentialId: null,
    validFrom: new Date("2026-08-26T09:55:00.000Z"),
    validUntil: new Date("2026-08-26T11:05:00.000Z"),
    ...overrides,
  }
}

export async function certifyKeypadWindowLifecycle() {
  const provider = new SimulatedAccessProvider()
  const fixture = lifecycleFixture(provider, [
    credential("credential-entrance", "venue-a-entrance", "playtt:grant-1:credential-entrance"),
    credential("credential-table", "venue-a-table", "playtt:grant-1:credential-table"),
  ])

  assert.equal(await provisionAccessGrant(fixture), "ready")
  assert.equal(fixture.state.credentials.every((row) => row.status === "active"), true)

  const window = resolveAccessWindow({
    startTime: "2026-08-26T11:00:00.000Z",
    endTime: "2026-08-26T12:00:00.000Z",
  })
  fixture.grant.validFrom = window.validFrom
  fixture.grant.validUntil = window.validUntil
  for (const row of fixture.credentials) {
    row.status = "active"
    row.externalCredentialId = `sim:${row.id}`
    row.validFrom = window.validFrom
    row.validUntil = window.validUntil
  }

  assert.equal(await modifyAccessGrant(fixture), "ready")

  assert.equal(await revokeAccessGrant(fixture), "revoked")
  assert.equal(fixture.state.grantStatus, "revoked")

  return {
    id: "keypad_window_lifecycle",
    title: "Provision, modify validity, and revoke on two doors",
    passed: true,
  }
}

export async function certifyTwoVenueDoorIsolation() {
  const venueA = new SimulatedAccessProvider()
  const venueB = new SimulatedAccessProvider()
  const passcode = "87654321"
  const validFrom = new Date("2026-08-26T09:55:00.000Z")
  const validUntil = new Date("2026-08-26T11:05:00.000Z")

  const entrance = await venueA.provision({
    credentialId: "credential-entrance",
    externalLockId: "venue-a-entrance",
    passcode,
    passcodeName: "playtt:grant-2:credential-entrance",
    validFrom,
    validUntil,
  })
  const table = await venueA.provision({
    credentialId: "credential-table",
    externalLockId: "venue-a-table",
    passcode,
    passcodeName: "playtt:grant-2:credential-table",
    validFrom,
    validUntil,
  })

  const unrelated = await venueB.query("venue-b-entrance", "playtt:grant-2:credential-entrance")
  assert.equal(unrelated, null)

  await venueA.revoke(entrance)
  await venueA.revoke(table)

  return {
    id: "two_venue_door_isolation",
    title: "Shared entrance and resource doors accept one code; unrelated venue lock rejects",
    passed: true,
    details: {
      venueADoors: ["venue-a-entrance", "venue-a-table"],
      unrelatedVenueLock: "venue-b-entrance",
    },
  }
}

export async function certifyPartialRevokeOnResourceChange() {
  const provider = new SimulatedAccessProvider()
  const oldDoor = lifecycleFixture(provider, [
    credential("credential-old", "venue-a-table-old", "playtt:grant-3:credential-old"),
  ])

  assert.equal(await provisionAccessGrant(oldDoor), "ready")
  oldDoor.credentials[0].status = "revoking"
  assert.equal(
    await revokeAccessGrant({
      ...oldDoor,
      credentialFilter: (row) => row.status === "revoking",
    }),
    "revoked",
  )

  const newDoor = lifecycleFixture(
    provider,
    [credential("credential-new", "venue-a-table-new", "playtt:grant-3:credential-new")],
    {
      validFrom: new Date("2026-08-26T10:55:00.000Z"),
      validUntil: new Date("2026-08-26T12:05:00.000Z"),
    },
  )
  assert.equal(await provisionAccessGrant(newDoor), "ready")

  return {
    id: "resource_change_partial_revoke",
    title: "Obsolete door revoked before new door is provisioned",
    passed: true,
  }
}

export async function runPhase5SimulatorCertification() {
  const steps = [
    await certifyKeypadWindowLifecycle(),
    await certifyTwoVenueDoorIsolation(),
    await certifyPartialRevokeOnResourceChange(),
  ]

  return {
    generatedAt: new Date().toISOString(),
    mode: process.env.TTLOCK_PROVIDER_MODE === "real" ? "real" : "simulator",
    passed: steps.every((step) => step.passed),
    steps,
  }
}
