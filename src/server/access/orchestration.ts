import { randomUUID } from "node:crypto"

import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  accessCredentials,
  accessGrants,
  bookings,
  locations,
  playSessions,
  ttlockAccessPointLocks,
  ttlockLocks,
} from "@/db/schema"
import { AccessDomainError } from "@/server/access/domain-error"
import { isAccessFeatureEnabled } from "@/server/access/feature-policy"
import {
  accessGrantSecretAad,
  encryptCredentialSecret,
} from "@/server/access/encryption"
import {
  buildProviderPasscodeName,
  fingerprintPasscode,
  generateBookingPasscode,
  resolveAccessWindow,
} from "@/server/access/policy.mjs"
import { resolveRequiredAccessPoints } from "@/server/catalog/access-points"
import { createServiceTenantContext } from "@/server/tenancy/context-factory"
import type { TenantContext } from "@/server/tenancy/types"
import { EVENT_TYPES, EVENT_VERSION } from "@/server/workers/events.mjs"
import { enqueueOutboxEvent } from "@/server/workers/outbox-repository"

function fingerprintKey() {
  const value = process.env.PLAYTT_PASSCODE_FINGERPRINT_KEY?.trim()
  if (!value) throw new Error("PLAYTT_PASSCODE_FINGERPRINT_KEY is not configured.")
  return value
}

export async function ensureAccessGrantForConfirmedBooking(
  context: TenantContext,
  bookingId: string,
) {
  const [booking] = await db
    .select({ booking: bookings, venueSettings: locations.settings })
    .from(bookings)
    .innerJoin(
      locations,
      and(
        eq(bookings.tenantId, locations.tenantId),
        eq(bookings.locationId, locations.id),
      ),
    )
    .where(
      and(
        eq(bookings.tenantId, context.tenantId),
        eq(bookings.id, bookingId),
      ),
    )
    .limit(1)

  if (!booking) {
    throw new AccessDomainError("ACCESS_NOT_FOUND", "Booking was not found.", 404)
  }
  if (
    booking.booking.status !== "confirmed" ||
    booking.booking.paymentStatus !== "paid"
  ) {
    throw new AccessDomainError(
      "ACCESS_NOT_ELIGIBLE",
      "Only paid confirmed bookings receive venue access.",
      409,
    )
  }

  const [existing] = await db
    .select()
    .from(accessGrants)
    .where(
      and(
        eq(accessGrants.tenantId, context.tenantId),
        eq(accessGrants.bookingId, bookingId),
      ),
    )
    .limit(1)
  if (existing) return existing

  const [playSession] = await db
    .select({ id: playSessions.id })
    .from(playSessions)
    .where(
      and(
        eq(playSessions.tenantId, context.tenantId),
        eq(playSessions.bookingId, bookingId),
      ),
    )
    .limit(1)

  const points = await resolveRequiredAccessPoints(context, booking.booking.resourceId)
  const targets = await Promise.all(
    points.map(async (point) => {
      const [target] = await db
        .select({
          accessPointId: ttlockAccessPointLocks.accessPointId,
          connectionId: ttlockAccessPointLocks.connectionId,
          lockDeviceId: ttlockLocks.deviceId,
          externalLockId: ttlockLocks.externalLockId,
          passcodeVersion: ttlockLocks.passcodeVersion,
          supportsCustomPasscodes: ttlockLocks.supportsCustomPasscodes,
          gatewayOnline: ttlockLocks.gatewayOnline,
        })
        .from(ttlockAccessPointLocks)
        .innerJoin(
          ttlockLocks,
          and(
            eq(ttlockAccessPointLocks.tenantId, ttlockLocks.tenantId),
            eq(ttlockAccessPointLocks.lockId, ttlockLocks.id),
          ),
        )
        .where(
          and(
            eq(ttlockAccessPointLocks.tenantId, context.tenantId),
            eq(ttlockAccessPointLocks.accessPointId, point.id),
            eq(ttlockAccessPointLocks.isActive, true),
          ),
        )
        .limit(1)
      return { point, target: target ?? null }
    }),
  )

  const configurationReady =
    targets.length > 0 &&
    targets.every(
      ({ target }) =>
        target?.lockDeviceId &&
        target.passcodeVersion === 4 &&
        target.supportsCustomPasscodes &&
        target.gatewayOnline,
    )
  const grantId = randomUUID()
  const passcode = generateBookingPasscode()
  const encryptedCode = encryptCredentialSecret(
    passcode,
    accessGrantSecretAad(context.tenantId, grantId),
  )
  const window = resolveAccessWindow({
    startTime: booking.booking.startTime,
    endTime: booking.booking.endTime,
    venueSettings: booking.venueSettings,
  })
  const status = configurationReady ? "configuring" : "action_required"

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(accessGrants)
      .values({
        id: grantId,
        tenantId: context.tenantId,
        bookingId,
        playSessionId: playSession?.id ?? null,
        ownerUserId: booking.booking.userId,
        locationId: booking.booking.locationId,
        resourceId: booking.booking.resourceId,
        encryptedCode,
        encryptionKeyVersion: encryptedCode.split(".", 1)[0],
        codeFingerprint: fingerprintPasscode(passcode, fingerprintKey()),
        validFrom: window.validFrom,
        validUntil: window.validUntil,
        status,
        correlationId: context.correlationId,
        failedAt: configurationReady ? null : new Date(),
      })
      .onConflictDoNothing()
      .returning()

    if (!inserted) {
      const [winner] = await tx
        .select()
        .from(accessGrants)
        .where(
          and(
            eq(accessGrants.tenantId, context.tenantId),
            eq(accessGrants.bookingId, bookingId),
          ),
        )
        .limit(1)
      if (!winner) throw new Error("Could not create or recover access grant.")
      return winner
    }

    if (configurationReady) {
      await tx.insert(accessCredentials).values(
        targets.map(({ point, target }) => {
          if (!target?.lockDeviceId) throw new Error("TTLock target is incomplete.")
          const credentialId = randomUUID()
          return {
            id: credentialId,
            tenantId: context.tenantId,
            bookingId,
            grantId,
            accessPointId: point.id,
            lockDeviceId: target.lockDeviceId,
            connectionId: target.connectionId,
            playSessionId: playSession?.id ?? null,
            locationId: booking.booking.locationId,
            stableName: buildProviderPasscodeName(grantId, credentialId),
            validFrom: window.validFrom,
            validUntil: window.validUntil,
            status: "pending" as const,
            nextAttemptAt: new Date(),
            metadata: { externalLockId: target.externalLockId },
          }
        }),
      )
    }

    await enqueueOutboxEvent(
      {
        tenantId: context.tenantId,
        venueId: booking.booking.locationId,
        resourceId: booking.booking.resourceId,
        sessionId: playSession?.id ?? null,
        aggregateType: "access_grant",
        aggregateId: grantId,
        eventType: configurationReady
          ? EVENT_TYPES.ACCESS_PROVISION_REQUESTED_V1
          : EVENT_TYPES.ACCESS_FAILED_V1,
        eventVersion: EVENT_VERSION,
        correlationId: context.correlationId,
        payload: { grantId, bookingId, userId: booking.booking.userId },
        idempotencyKey: configurationReady
          ? `access.provision.requested.v1:${grantId}`
          : `access.failed.v1:${grantId}:configuration`,
      },
      tx,
    )
    return inserted
  })
}

type BookingConfirmedEvent = {
  tenantId: string | null
  correlationId: string
  payload: Record<string, unknown>
}

export async function consumeBookingConfirmedForAccess(row: BookingConfirmedEvent) {
  const tenantId = row.tenantId
  const bookingId = String(row.payload.bookingId ?? "")
  if (!tenantId || !bookingId) {
    throw new Error("booking.confirmed.v1 access event is missing tenant or booking.")
  }
  const context = createServiceTenantContext({
    tenantId,
    actorId: "access-orchestration",
    correlationId: row.correlationId,
  })
  if (!(await isAccessFeatureEnabled(context, "liveAccess"))) return null
  return ensureAccessGrantForConfirmedBooking(context, bookingId)
}

type BookingTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function resolveAccessTargets(
  context: TenantContext,
  resourceId: string,
) {
  const points = await resolveRequiredAccessPoints(context, resourceId)
  return Promise.all(
    points.map(async (point) => {
      const [target] = await db
        .select({
          accessPointId: ttlockAccessPointLocks.accessPointId,
          connectionId: ttlockAccessPointLocks.connectionId,
          lockDeviceId: ttlockLocks.deviceId,
          externalLockId: ttlockLocks.externalLockId,
          passcodeVersion: ttlockLocks.passcodeVersion,
          supportsCustomPasscodes: ttlockLocks.supportsCustomPasscodes,
          gatewayOnline: ttlockLocks.gatewayOnline,
        })
        .from(ttlockAccessPointLocks)
        .innerJoin(
          ttlockLocks,
          and(
            eq(ttlockAccessPointLocks.tenantId, ttlockLocks.tenantId),
            eq(ttlockAccessPointLocks.lockId, ttlockLocks.id),
          ),
        )
        .where(
          and(
            eq(ttlockAccessPointLocks.tenantId, context.tenantId),
            eq(ttlockAccessPointLocks.accessPointId, point.id),
            eq(ttlockAccessPointLocks.isActive, true),
          ),
        )
        .limit(1)
      return { point, target: target ?? null }
    }),
  )
}

export async function applyAccessModificationForBooking(
  context: TenantContext,
  input: {
    bookingId: string
    modificationId: string
    resourceId: string
    startTime: Date
    endTime: Date
    venueSettings?: Record<string, unknown> | null
  },
  tx?: BookingTransaction,
) {
  if (!(await isAccessFeatureEnabled(context, "liveAccess"))) return null

  const executor = tx ?? db
  const [grant] = await executor
    .select()
    .from(accessGrants)
    .where(
      and(
        eq(accessGrants.tenantId, context.tenantId),
        eq(accessGrants.bookingId, input.bookingId),
        eq(accessGrants.status, "ready"),
      ),
    )
    .limit(1)

  if (!grant) return null

  const window = resolveAccessWindow({
    startTime: input.startTime,
    endTime: input.endTime,
    venueSettings: input.venueSettings,
  })
  const resourceChanged = grant.resourceId !== input.resourceId
  const timeChanged =
    grant.validFrom.getTime() !== window.validFrom.getTime() ||
    grant.validUntil.getTime() !== window.validUntil.getTime()

  if (!resourceChanged && !timeChanged) return grant

  const existingCredentials = await executor
    .select()
    .from(accessCredentials)
    .where(
      and(
        eq(accessCredentials.tenantId, context.tenantId),
        eq(accessCredentials.grantId, grant.id),
      ),
    )

  const apply = async (workTx: BookingTransaction) => {
    await workTx
      .update(accessGrants)
      .set({
        resourceId: input.resourceId,
        validFrom: window.validFrom,
        validUntil: window.validUntil,
        status: "configuring",
        revealReadyAt: null,
        updatedAt: new Date(),
      })
      .where(eq(accessGrants.id, grant.id))

    if (resourceChanged) {
      const targets = await resolveAccessTargets(context, input.resourceId)
      const nextPointIds = new Set(targets.map(({ point }) => point.id))
      const obsolete = existingCredentials.filter(
        (credential) => !nextPointIds.has(credential.accessPointId),
      )
      const keptPointIds = new Set(
        existingCredentials
          .filter((credential) => nextPointIds.has(credential.accessPointId))
          .map((credential) => credential.accessPointId),
      )

      for (const credential of obsolete) {
        if (["revoked", "expired"].includes(credential.status)) continue
        await workTx
          .update(accessCredentials)
          .set({
            status: "revoking",
            revokeRequestedAt: new Date(),
            nextAttemptAt: new Date(),
          })
          .where(eq(accessCredentials.id, credential.id))
      }

      for (const credential of existingCredentials) {
        if (!keptPointIds.has(credential.accessPointId)) continue
        await workTx
          .update(accessCredentials)
          .set({
            validFrom: window.validFrom,
            validUntil: window.validUntil,
            status: credential.status === "active" ? "modifying" : credential.status,
            nextAttemptAt: new Date(),
          })
          .where(eq(accessCredentials.id, credential.id))
      }

      const newTargets = targets.filter(
        ({ point }) => !keptPointIds.has(point.id),
      )
      if (newTargets.length > 0) {
        await workTx.insert(accessCredentials).values(
          newTargets.map(({ point, target }) => {
            if (!target?.lockDeviceId) {
              throw new AccessDomainError(
                "ACCESS_CONFIGURATION_ERROR",
                "A required door is not commissioned.",
                409,
              )
            }
            const credentialId = randomUUID()
            return {
              id: credentialId,
              tenantId: context.tenantId,
              bookingId: input.bookingId,
              grantId: grant.id,
              accessPointId: point.id,
              lockDeviceId: target.lockDeviceId,
              connectionId: target.connectionId,
              playSessionId: grant.playSessionId,
              locationId: grant.locationId,
              stableName: buildProviderPasscodeName(grant.id, credentialId),
              validFrom: window.validFrom,
              validUntil: window.validUntil,
              status: "pending" as const,
              nextAttemptAt: new Date(),
              metadata: { externalLockId: target.externalLockId },
            }
          }),
        )
      }

      if (obsolete.length > 0) {
        await enqueueOutboxEvent(
          {
            tenantId: context.tenantId,
            venueId: grant.locationId,
            resourceId: input.resourceId,
            sessionId: grant.playSessionId,
            aggregateType: "access_grant",
            aggregateId: grant.id,
            eventType: EVENT_TYPES.ACCESS_REVOKE_REQUESTED_V1,
            eventVersion: EVENT_VERSION,
            correlationId: context.correlationId,
            payload: {
              grantId: grant.id,
              bookingId: input.bookingId,
              modificationId: input.modificationId,
              reason: "booking_resource_changed",
            },
            idempotencyKey: `access.revoke.requested.v1:${grant.id}:mod:${input.modificationId}`,
          },
          workTx,
        )
      }

      if (keptPointIds.size > 0) {
        await enqueueOutboxEvent(
          {
            tenantId: context.tenantId,
            venueId: grant.locationId,
            resourceId: input.resourceId,
            sessionId: grant.playSessionId,
            aggregateType: "access_grant",
            aggregateId: grant.id,
            eventType: EVENT_TYPES.ACCESS_MODIFY_REQUESTED_V1,
            eventVersion: EVENT_VERSION,
            correlationId: context.correlationId,
            payload: {
              grantId: grant.id,
              bookingId: input.bookingId,
              modificationId: input.modificationId,
            },
            idempotencyKey: `access.modify.v1:${grant.id}:mod:${input.modificationId}`,
          },
          workTx,
        )
      }

      if (newTargets.length > 0) {
        await enqueueOutboxEvent(
          {
            tenantId: context.tenantId,
            venueId: grant.locationId,
            resourceId: input.resourceId,
            sessionId: grant.playSessionId,
            aggregateType: "access_grant",
            aggregateId: grant.id,
            eventType: EVENT_TYPES.ACCESS_PROVISION_REQUESTED_V1,
            eventVersion: EVENT_VERSION,
            correlationId: context.correlationId,
            payload: {
              grantId: grant.id,
              bookingId: input.bookingId,
              modificationId: input.modificationId,
            },
            idempotencyKey: `access.provision.requested.v1:${grant.id}:mod:${input.modificationId}`,
          },
          workTx,
        )
      }
    } else {
      await workTx
        .update(accessCredentials)
        .set({
          validFrom: window.validFrom,
          validUntil: window.validUntil,
          status: "modifying",
          nextAttemptAt: new Date(),
        })
        .where(
          and(
            eq(accessCredentials.tenantId, context.tenantId),
            eq(accessCredentials.grantId, grant.id),
            eq(accessCredentials.status, "active"),
          ),
        )
    }

    if (!resourceChanged) {
      await enqueueOutboxEvent(
        {
          tenantId: context.tenantId,
          venueId: grant.locationId,
          resourceId: input.resourceId,
          sessionId: grant.playSessionId,
          aggregateType: "access_grant",
          aggregateId: grant.id,
          eventType: EVENT_TYPES.ACCESS_MODIFY_REQUESTED_V1,
          eventVersion: EVENT_VERSION,
          correlationId: context.correlationId,
          payload: {
            grantId: grant.id,
            bookingId: input.bookingId,
            modificationId: input.modificationId,
          },
          idempotencyKey: `access.modify.v1:${grant.id}:${input.modificationId}`,
        },
        workTx,
      )
    }
  }

  if (tx) {
    await apply(tx)
  } else {
    await db.transaction(apply)
  }

  return grant
}
