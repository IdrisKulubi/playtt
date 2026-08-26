import { and, eq, inArray, lte, or } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  accessCredentials,
  accessGrants,
  bookings,
  ttlockLocks,
} from "@/db/schema"
import {
  accessGrantSecretAad,
  decryptCredentialSecret,
} from "@/server/access/encryption"
import {
  modifyAccessGrant,
  provisionAccessGrant,
  revokeAccessGrant,
} from "@/server/access/lifecycle-core.mjs"
import { getAccessProviderForConnection } from "@/server/access/provider-factory"
import { redactAccessText } from "@/server/access/redaction.mjs"
import { consumeBookingConfirmedForAccess } from "@/server/access/orchestration"
import { EVENT_TYPES, EVENT_VERSION } from "@/server/workers/events.mjs"
import { enqueueOutboxEvent } from "@/server/workers/outbox-repository"

type CredentialRow = typeof accessCredentials.$inferSelect & {
  externalLockId: string
  externalCredentialId: string | null
}

async function loadGrant(grantId: string, tenantId: string) {
  const [grant] = await db
    .select()
    .from(accessGrants)
    .where(
      and(eq(accessGrants.id, grantId), eq(accessGrants.tenantId, tenantId)),
    )
    .limit(1)
  if (!grant) throw new Error("Access grant was not found.")
  return {
    ...grant,
    passcode: decryptCredentialSecret(
      grant.encryptedCode,
      accessGrantSecretAad(tenantId, grant.id),
    ),
  }
}

async function listCredentials(grantId: string, tenantId: string) {
  const rows = await db
    .select({ credential: accessCredentials, externalLockId: ttlockLocks.externalLockId })
    .from(accessCredentials)
    .innerJoin(
      ttlockLocks,
      and(
        eq(accessCredentials.tenantId, ttlockLocks.tenantId),
        eq(accessCredentials.lockDeviceId, ttlockLocks.deviceId),
      ),
    )
    .where(
      and(
        eq(accessCredentials.tenantId, tenantId),
        eq(accessCredentials.grantId, grantId),
      ),
    )
  return rows.map(
    ({ credential, externalLockId }) =>
      ({
        ...credential,
        externalLockId,
        externalCredentialId: credential.externalReference ?? null,
      }) satisfies CredentialRow,
  )
}

function lifecycleRepository(tenantId: string) {
  return {
    listCredentials: (grantId: string) => listCredentials(grantId, tenantId),
    markCredentialProvisioning: async (credential: CredentialRow) => {
      await db
        .update(accessCredentials)
        .set({
          status: "provisioning",
          attemptCount: credential.attemptCount + 1,
          providerErrorCategory: null,
          providerErrorCode: null,
        })
        .where(
          and(
            eq(accessCredentials.tenantId, tenantId),
            eq(accessCredentials.id, credential.id),
          ),
        )
      credential.status = "provisioning"
      credential.attemptCount += 1
    },
    markCredentialActive: async (
      credential: CredentialRow,
      result: { externalCredentialId: string },
    ) => {
      await db
        .update(accessCredentials)
        .set({
          status: "active",
          externalReference: result.externalCredentialId,
          provisionedAt: new Date(),
          nextAttemptAt: null,
          providerErrorCategory: null,
          providerErrorCode: null,
          validFrom: credential.validFrom,
          validUntil: credential.validUntil,
        })
        .where(eq(accessCredentials.id, credential.id))
      credential.status = "active"
      credential.externalReference = result.externalCredentialId
      credential.externalCredentialId = result.externalCredentialId
    },
    markCredentialModifying: async (credential: CredentialRow) => {
      await db
        .update(accessCredentials)
        .set({
          status: "modifying",
          attemptCount: credential.attemptCount + 1,
          providerErrorCategory: null,
          providerErrorCode: null,
        })
        .where(eq(accessCredentials.id, credential.id))
      credential.status = "modifying"
      credential.attemptCount += 1
    },
    markCredentialRetrying: async (
      credential: CredentialRow,
      failure: { kind: string; message: string; delaySeconds: number },
    ) => {
      await db
        .update(accessCredentials)
        .set({
          status: "retrying",
          providerErrorCategory: failure.kind,
          providerErrorCode: redactAccessText(failure.message).slice(0, 200),
          nextAttemptAt: new Date(Date.now() + failure.delaySeconds * 1000),
        })
        .where(eq(accessCredentials.id, credential.id))
      credential.status = "retrying"
    },
    markCredentialFailed: async (
      credential: CredentialRow,
      failure: { kind: string; message: string },
    ) => {
      await db
        .update(accessCredentials)
        .set({
          status: "failed",
          providerErrorCategory: failure.kind,
          providerErrorCode: redactAccessText(failure.message).slice(0, 200),
          nextAttemptAt: null,
        })
        .where(eq(accessCredentials.id, credential.id))
      credential.status = "failed"
    },
    markCredentialRevoked: async (credential: CredentialRow) => {
      await db
        .update(accessCredentials)
        .set({ status: "revoked", revokedAt: new Date(), nextAttemptAt: null })
        .where(eq(accessCredentials.id, credential.id))
      credential.status = "revoked"
    },
    markGrantReady: async (grant: Awaited<ReturnType<typeof loadGrant>>) => {
      await db.transaction(async (tx) => {
        const now = new Date()
        await tx
          .update(accessGrants)
          .set({ status: "ready", revealReadyAt: now, failedAt: null })
          .where(eq(accessGrants.id, grant.id))
        await enqueueOutboxEvent(
          {
            tenantId,
            venueId: grant.locationId,
            resourceId: grant.resourceId,
            sessionId: grant.playSessionId,
            aggregateType: "access_grant",
            aggregateId: grant.id,
            eventType: EVENT_TYPES.ACCESS_READY_V1,
            eventVersion: EVENT_VERSION,
            correlationId: grant.correlationId,
            payload: {
              grantId: grant.id,
              bookingId: grant.bookingId,
              userId: grant.ownerUserId,
            },
            idempotencyKey: `access.ready.v1:${grant.id}`,
          },
          tx,
        )
      })
    },
    markGrantActionRequired: async (grant: Awaited<ReturnType<typeof loadGrant>>) => {
      await db
        .update(accessGrants)
        .set({ status: "action_required", failedAt: new Date(), revealReadyAt: null })
        .where(eq(accessGrants.id, grant.id))
    },
    markGrantTemporarilyUnavailable: async (
      grant: Awaited<ReturnType<typeof loadGrant>>,
    ) => {
      await db
        .update(accessGrants)
        .set({ status: "temporarily_unavailable", revealReadyAt: null })
        .where(eq(accessGrants.id, grant.id))
    },
    markGrantRevoking: async (grant: Awaited<ReturnType<typeof loadGrant>>) => {
      await db
        .update(accessGrants)
        .set({ status: "revoking", revealReadyAt: null })
        .where(eq(accessGrants.id, grant.id))
    },
    markGrantRevoked: async (grant: Awaited<ReturnType<typeof loadGrant>>) => {
      await db.transaction(async (tx) => {
        await tx
          .update(accessGrants)
          .set({ status: "revoked", revokedAt: new Date(), revealReadyAt: null })
          .where(eq(accessGrants.id, grant.id))
        await enqueueOutboxEvent(
          {
            tenantId,
            venueId: grant.locationId,
            resourceId: grant.resourceId,
            sessionId: grant.playSessionId,
            aggregateType: "access_grant",
            aggregateId: grant.id,
            eventType: EVENT_TYPES.ACCESS_REVOKED_V1,
            eventVersion: EVENT_VERSION,
            correlationId: grant.correlationId,
            payload: { grantId: grant.id, bookingId: grant.bookingId },
            idempotencyKey: `access.revoked.v1:${grant.id}`,
          },
          tx,
        )
      })
    },
  }
}

export async function processAccessModification(tenantId: string, grantId: string) {
  const grant = await loadGrant(grantId, tenantId)
  const credentials = await listCredentials(grantId, tenantId)
  return modifyAccessGrant({
    grant,
    credentials,
    providerFor: (credential: CredentialRow) => {
      if (!credential.connectionId) throw new Error("Credential has no TTLock connection.")
      return getAccessProviderForConnection(tenantId, credential.connectionId)
    },
    repository: lifecycleRepository(tenantId),
  })
}

export async function processAccessProvisioning(tenantId: string, grantId: string) {
  const grant = await loadGrant(grantId, tenantId)
  const credentials = await listCredentials(grantId, tenantId)
  return provisionAccessGrant({
    grant,
    credentials,
    providerFor: (credential: CredentialRow) => {
      if (!credential.connectionId) throw new Error("Credential has no TTLock connection.")
      return getAccessProviderForConnection(tenantId, credential.connectionId)
    },
    repository: lifecycleRepository(tenantId),
  })
}

export async function processAccessRevocation(
  tenantId: string,
  grantId: string,
  options?: { obsoleteOnly?: boolean },
) {
  const grant = await loadGrant(grantId, tenantId)
  const credentials = await listCredentials(grantId, tenantId)
  return revokeAccessGrant({
    grant,
    credentials,
    providerFor: (credential: CredentialRow) => {
      if (!credential.connectionId) throw new Error("Credential has no TTLock connection.")
      return getAccessProviderForConnection(tenantId, credential.connectionId)
    },
    repository: lifecycleRepository(tenantId),
    credentialFilter: options?.obsoleteOnly
      ? (credential: CredentialRow) => credential.status === "revoking"
      : null,
  })
}

type AccessEvent = { tenantId: string | null; payload: Record<string, unknown> }

async function consumeProvision(row: AccessEvent) {
  const tenantId = row.tenantId
  const grantId = String(row.payload.grantId ?? "")
  if (!tenantId || !grantId) throw new Error("Access provision event is incomplete.")
  return processAccessProvisioning(tenantId, grantId)
}

async function consumeRevoke(row: AccessEvent) {
  const tenantId = row.tenantId
  const grantId = String(row.payload.grantId ?? "")
  const reason = String(row.payload.reason ?? "")
  if (!tenantId || !grantId) throw new Error("Access revoke event is incomplete.")
  return processAccessRevocation(tenantId, grantId, {
    obsoleteOnly: reason === "booking_resource_changed",
  })
}

async function consumeModify(row: AccessEvent) {
  const tenantId = row.tenantId
  const grantId = String(row.payload.grantId ?? "")
  if (!tenantId || !grantId) throw new Error("Access modify event is incomplete.")
  return processAccessModification(tenantId, grantId)
}

export function createAccessConsumers() {
  return {
    [EVENT_TYPES.BOOKING_CONFIRMED_V1]: {
      eventVersion: EVENT_VERSION,
      consume: consumeBookingConfirmedForAccess,
    },
    [EVENT_TYPES.ACCESS_PROVISION_REQUESTED_V1]: {
      eventVersion: EVENT_VERSION,
      consume: consumeProvision,
    },
    [EVENT_TYPES.ACCESS_MODIFY_REQUESTED_V1]: {
      eventVersion: EVENT_VERSION,
      consume: consumeModify,
    },
    [EVENT_TYPES.ACCESS_REVOKE_REQUESTED_V1]: {
      eventVersion: EVENT_VERSION,
      consume: consumeRevoke,
    },
  }
}

export async function reconcileAccessLifecycle(now = new Date()) {
  const retryRows = await db
    .select({ tenantId: accessGrants.tenantId, grantId: accessGrants.id })
    .from(accessCredentials)
    .innerJoin(
      accessGrants,
      and(
        eq(accessCredentials.tenantId, accessGrants.tenantId),
        eq(accessCredentials.grantId, accessGrants.id),
      ),
    )
    .where(
      and(
        eq(accessCredentials.status, "retrying"),
        lte(accessCredentials.nextAttemptAt, now),
      ),
    )

  const revokeRows = await db
    .select({ tenantId: accessGrants.tenantId, grantId: accessGrants.id })
    .from(accessGrants)
    .innerJoin(
      bookings,
      and(
        eq(accessGrants.tenantId, bookings.tenantId),
        eq(accessGrants.bookingId, bookings.id),
      ),
    )
    .where(
      and(
        inArray(accessGrants.status, [
          "configuring",
          "ready",
          "temporarily_unavailable",
          "action_required",
        ]),
        inArray(bookings.status, ["cancelled", "expired"]),
      ),
    )

  const expireRows = await db
    .select({ tenantId: accessGrants.tenantId, grantId: accessGrants.id })
    .from(accessGrants)
    .where(
      and(
        inArray(accessGrants.status, [
          "ready",
          "temporarily_unavailable",
          "action_required",
        ]),
        lte(accessGrants.validUntil, now),
      ),
    )

  const revokeRetryRows = await db
    .select({ tenantId: accessGrants.tenantId, grantId: accessGrants.id })
    .from(accessCredentials)
    .innerJoin(
      accessGrants,
      and(
        eq(accessCredentials.tenantId, accessGrants.tenantId),
        eq(accessCredentials.grantId, accessGrants.id),
      ),
    )
    .where(
      and(
        eq(accessGrants.status, "revoking"),
        or(
          eq(accessCredentials.status, "retrying"),
          eq(accessCredentials.status, "revoking"),
        ),
        lte(accessCredentials.nextAttemptAt, now),
      ),
    )

  const retryKeys = new Set(retryRows.map((row) => `${row.tenantId}:${row.grantId}`))
  const revokeKeys = new Set([
    ...revokeRows.map((row) => `${row.tenantId}:${row.grantId}`),
    ...expireRows.map((row) => `${row.tenantId}:${row.grantId}`),
    ...revokeRetryRows.map((row) => `${row.tenantId}:${row.grantId}`),
  ])
  await Promise.all(
    [...retryKeys].map((key) => {
      const [tenantId, grantId] = key.split(":")
      return processAccessProvisioning(tenantId, grantId)
    }),
  )
  await Promise.all(
    [...revokeKeys].map((key) => {
      const [tenantId, grantId] = key.split(":")
      return processAccessRevocation(tenantId, grantId)
    }),
  )
  return {
    retried: retryKeys.size,
    revoked: revokeKeys.size,
    expired: expireRows.length,
  }
}
