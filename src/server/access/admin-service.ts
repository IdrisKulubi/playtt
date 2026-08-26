import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { and, count, desc, eq, gt, inArray } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  accessCredentials,
  accessGrants,
  accessPoints,
  auditLogs,
  ttlockAccessPointLocks,
  ttlockConnections,
  ttlockGateways,
  ttlockLocks,
  ttlockUnlockRecords,
  user,
  verification,
} from "@/db/schema"
import type { AccessOperationsSnapshot, TtlockRegion } from "@/server/access/admin-contract"
import {
  decryptCredentialSecret,
  encryptCredentialSecret,
  parseCredentialKeyring,
  ttlockConnectionSecretAad,
} from "@/server/access/encryption"
import { AccessDomainError } from "@/server/access/domain-error"
import { exchangeTtlockPassword, TtlockAccessProvider } from "@/server/access/ttlock-client"
import { redactAccessValue } from "@/server/access/redaction.mjs"
import { renderOtpEmailHtml } from "@/lib/email/render-otp-email"
import { Resend } from "resend"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import type { TenantContext } from "@/server/tenancy/types"
import { enqueueOutboxEvent } from "@/server/workers/outbox-repository"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder")
const resendFromEmail =
  process.env.RESEND_FROM_EMAIL?.trim().toLowerCase() || "onboarding@resend.dev"

const REGION_URLS: Record<TtlockRegion, string> = {
  global: "https://api.sciener.com",
  eu: "https://euapi.sciener.com",
}

function regionForUrl(url: string): TtlockRegion {
  return url === REGION_URLS.eu ? "eu" : "global"
}

function connectionSummary(row: typeof ttlockConnections.$inferSelect) {
  const now = Date.now()
  return {
    id: row.id,
    name: row.name,
    region: regionForUrl(row.apiBaseUrl),
    status: row.status,
    tokenHealth:
      row.status === "reauth_required"
        ? "reauth_required"
        : !row.accessTokenExpiresAt
          ? "missing"
          : row.accessTokenExpiresAt.getTime() <= now
            ? "expired"
            : row.accessTokenExpiresAt.getTime() <= now + 15 * 60_000
              ? "expiring"
              : "healthy",
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
  }
}

export async function listAccessOperations(
  context: TenantContext,
  input: { locationId?: string },
): Promise<AccessOperationsSnapshot> {
  authorize(context, "access.manage")
  const [connections, gateways, locks, grants, points] = await Promise.all([
    db.select().from(ttlockConnections).where(eq(ttlockConnections.tenantId, context.tenantId)).orderBy(ttlockConnections.name),
    db.select().from(ttlockGateways).where(eq(ttlockGateways.tenantId, context.tenantId)).orderBy(ttlockGateways.name),
    db
      .select({ lock: ttlockLocks, accessPointId: ttlockAccessPointLocks.accessPointId })
      .from(ttlockLocks)
      .leftJoin(
        ttlockAccessPointLocks,
        and(
          eq(ttlockAccessPointLocks.tenantId, context.tenantId),
          eq(ttlockAccessPointLocks.lockId, ttlockLocks.id),
          eq(ttlockAccessPointLocks.isActive, true),
        ),
      )
      .where(eq(ttlockLocks.tenantId, context.tenantId))
      .orderBy(ttlockLocks.name),
    db
      .select({ grant: accessGrants, credentialCount: count(accessCredentials.id) })
      .from(accessGrants)
      .leftJoin(
        accessCredentials,
        and(
          eq(accessCredentials.tenantId, accessGrants.tenantId),
          eq(accessCredentials.grantId, accessGrants.id),
        ),
      )
      .where(
        and(
          eq(accessGrants.tenantId, context.tenantId),
          input.locationId ? eq(accessGrants.locationId, input.locationId) : undefined,
        ),
      )
      .groupBy(accessGrants.id)
      .orderBy(desc(accessGrants.updatedAt))
      .limit(100),
    db
      .select({
        id: accessPoints.id,
        name: accessPoints.name,
        kind: accessPoints.kind,
        locationId: accessPoints.locationId,
      })
      .from(accessPoints)
      .where(
        and(
          eq(accessPoints.tenantId, context.tenantId),
          eq(accessPoints.isActive, true),
          input.locationId ? eq(accessPoints.locationId, input.locationId) : undefined,
        ),
      )
      .orderBy(accessPoints.sortOrder, accessPoints.name),
  ])

  const activeCounts = grants.length
    ? await db
        .select({ grantId: accessCredentials.grantId, value: count(accessCredentials.id) })
        .from(accessCredentials)
        .where(
          and(
            eq(accessCredentials.tenantId, context.tenantId),
            inArray(accessCredentials.grantId, grants.map(({ grant }) => grant.id)),
            eq(accessCredentials.status, "active"),
          ),
        )
        .groupBy(accessCredentials.grantId)
    : []

  return {
    connections: connections.map(connectionSummary),
    gateways: gateways.map((row) => ({
      id: row.id,
      connectionId: row.connectionId,
      name: row.name ?? row.externalGatewayId,
      online: row.status === "online",
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    })),
    locks: locks.map(({ lock, accessPointId }) => ({
      id: lock.id,
      connectionId: lock.connectionId,
      gatewayId: lock.gatewayId,
      accessPointId,
      name: lock.name ?? lock.externalLockId,
      online: lock.status === "online" && lock.gatewayOnline,
      supportsCustomPasscodes: lock.supportsCustomPasscodes,
      passcodeVersion: lock.passcodeVersion,
      batteryLevel: lock.batteryPercent,
    })),
    accessPoints: points.map((point) => ({
      id: point.id,
      name: point.name,
      kind: point.kind,
      locationId: point.locationId,
    })),
    grants: grants.map(({ grant, credentialCount }) => ({
      id: grant.id,
      bookingId: grant.bookingId,
      locationId: grant.locationId,
      status: grant.status,
      credentialCount,
      activeCredentialCount:
        activeCounts.find((row) => row.grantId === grant.id)?.value ?? 0,
      validFrom: grant.validFrom.toISOString(),
      validUntil: grant.validUntil.toISOString(),
      lastError: null,
      updatedAt: grant.updatedAt.toISOString(),
    })),
  }
}

export async function commissionTtlockConnection(
  context: TenantContext,
  input: {
    name: string
    region: TtlockRegion
    clientId: string
    clientSecret: string
    username: string
    password: string
  },
) {
  authorize(context, "access.manage")
  const id = randomUUID()
  const apiBaseUrl = REGION_URLS[input.region]
  const token = await exchangeTtlockPassword({
    baseUrl: apiBaseUrl,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    username: input.username,
    password: input.password,
  })
  const keyring = parseCredentialKeyring()
  const [row] = await db
    .insert(ttlockConnections)
    .values({
      id,
      tenantId: context.tenantId,
      name: input.name,
      apiBaseUrl,
      clientId: input.clientId,
      encryptedClientSecret: encryptCredentialSecret(input.clientSecret, ttlockConnectionSecretAad(context.tenantId, id, "client-secret"), keyring),
      clientSecretKeyVersion: keyring.current,
      encryptedAccessToken: encryptCredentialSecret(token.accessToken, ttlockConnectionSecretAad(context.tenantId, id, "access-token"), keyring),
      accessTokenKeyVersion: keyring.current,
      encryptedRefreshToken: encryptCredentialSecret(token.refreshToken, ttlockConnectionSecretAad(context.tenantId, id, "refresh-token"), keyring),
      refreshTokenKeyVersion: keyring.current,
      accessTokenExpiresAt: new Date(Date.now() + token.expiresInSeconds * 1000),
      status: "active",
    })
    .returning()
  await writeAuditLog(context, { action: "access.ttlock_connection.commissioned", targetType: "ttlock_connection", targetId: row.id, metadata: { region: input.region } })
  return connectionSummary(row)
}

async function loadConnection(context: TenantContext, connectionId: string) {
  const [row] = await db.select().from(ttlockConnections).where(and(eq(ttlockConnections.tenantId, context.tenantId), eq(ttlockConnections.id, connectionId))).limit(1)
  if (!row) throw new AccessDomainError("ACCESS_NOT_FOUND", "TTLock connection was not found.", 404)
  return row
}

function providerForConnection(context: TenantContext, connection: typeof ttlockConnections.$inferSelect) {
  if (!connection.encryptedAccessToken) throw new AccessDomainError("ACCESS_CONFIGURATION_ERROR", "TTLock connection has no access token.", 409)
  const accessToken = decryptCredentialSecret(connection.encryptedAccessToken, ttlockConnectionSecretAad(context.tenantId, connection.id, "access-token"))
  return new TtlockAccessProvider({ baseUrl: connection.apiBaseUrl, token: async () => ({ clientId: connection.clientId, accessToken }) })
}

export async function syncTtlockInventory(context: TenantContext, input: { connectionId: string }) {
  authorize(context, "access.manage")
  const connection = await loadConnection(context, input.connectionId)
  const inventory = await providerForConnection(context, connection).inventory()
  const now = new Date()
  await db.transaction(async (tx) => {
    for (const gateway of inventory.gateways) {
      await tx.insert(ttlockGateways).values({ tenantId: context.tenantId, connectionId: connection.id, externalGatewayId: gateway.externalGatewayId, name: gateway.externalGatewayId, status: gateway.online ? "online" : "offline", lockCount: gateway.lockCount, lastSeenAt: gateway.online ? now : null, lastSyncAt: now, metadata: { macAddress: gateway.macAddress } }).onConflictDoUpdate({ target: [ttlockGateways.connectionId, ttlockGateways.externalGatewayId], set: { status: gateway.online ? "online" : "offline", lockCount: gateway.lockCount, lastSeenAt: gateway.online ? now : null, lastSyncAt: now, metadata: { macAddress: gateway.macAddress }, updatedAt: now } })
    }
    const gatewayRows = await tx.select({ id: ttlockGateways.id, externalGatewayId: ttlockGateways.externalGatewayId }).from(ttlockGateways).where(and(eq(ttlockGateways.tenantId, context.tenantId), eq(ttlockGateways.connectionId, connection.id)))
    for (const lock of inventory.locks) {
      const gatewayId = gatewayRows.find((row) => lock.externalGatewayIds.includes(row.externalGatewayId))?.id ?? null
      const ready = lock.passcodeVersion === 4 && Boolean(gatewayId)
      await tx.insert(ttlockLocks).values({ tenantId: context.tenantId, connectionId: connection.id, gatewayId, externalLockId: lock.externalLockId, name: lock.name, status: ready ? "online" : lock.hasGateway ? "unsupported" : "offline", passcodeVersion: lock.passcodeVersion, supportsCustomPasscodes: lock.passcodeVersion === 4, gatewayOnline: Boolean(gatewayId), batteryPercent: lock.batteryLevel, lastSeenAt: ready ? now : null, lastSyncAt: now, metadata: { alias: lock.alias, macAddress: lock.macAddress } }).onConflictDoUpdate({ target: [ttlockLocks.connectionId, ttlockLocks.externalLockId], set: { gatewayId, name: lock.name, status: ready ? "online" : lock.hasGateway ? "unsupported" : "offline", passcodeVersion: lock.passcodeVersion, supportsCustomPasscodes: lock.passcodeVersion === 4, gatewayOnline: Boolean(gatewayId), batteryPercent: lock.batteryLevel, lastSeenAt: ready ? now : null, lastSyncAt: now, metadata: { alias: lock.alias, macAddress: lock.macAddress }, updatedAt: now } })
    }
    await tx.update(ttlockConnections).set({ lastSyncAt: now, lastErrorCode: null, status: "active", updatedAt: now }).where(and(eq(ttlockConnections.tenantId, context.tenantId), eq(ttlockConnections.id, connection.id)))
  })
  await writeAuditLog(context, { action: "access.ttlock_inventory.synced", targetType: "ttlock_connection", targetId: connection.id, metadata: { gatewayCount: inventory.gateways.length, lockCount: inventory.locks.length } })
  return { connectionId: connection.id, gatewayCount: inventory.gateways.length, lockCount: inventory.locks.length, syncedAt: now.toISOString() }
}

export async function assignTtlockLockToAccessPoint(context: TenantContext, input: { lockId: string; accessPointId: string }) {
  authorize(context, "access.manage")
  const [[lock], [point]] = await Promise.all([
    db.select().from(ttlockLocks).where(and(eq(ttlockLocks.tenantId, context.tenantId), eq(ttlockLocks.id, input.lockId))).limit(1),
    db.select({ id: accessPoints.id }).from(accessPoints).where(and(eq(accessPoints.tenantId, context.tenantId), eq(accessPoints.id, input.accessPointId))).limit(1),
  ])
  if (!lock || !point) throw new AccessDomainError("ACCESS_NOT_FOUND", "Lock or access point was not found.", 404)
  if (!lock.gatewayOnline || !lock.supportsCustomPasscodes || lock.passcodeVersion !== 4) throw new AccessDomainError("ACCESS_CONFIGURATION_ERROR", "Lock requires an online gateway and V4 custom passcodes.", 409)
  const [assignment] = await db.transaction(async (tx) => {
    await tx.update(ttlockAccessPointLocks).set({ isActive: false, updatedAt: new Date() }).where(and(eq(ttlockAccessPointLocks.tenantId, context.tenantId), eq(ttlockAccessPointLocks.isActive, true), inArray(ttlockAccessPointLocks.lockId, [lock.id])))
    return tx.insert(ttlockAccessPointLocks).values({ tenantId: context.tenantId, accessPointId: point.id, lockId: lock.id, connectionId: lock.connectionId, commissionedAt: new Date(), isActive: true }).returning()
  })
  await writeAuditLog(context, { action: "access.ttlock_lock.assigned", targetType: "ttlock_lock", targetId: lock.id, metadata: { accessPointId: point.id } })
  return { id: assignment.id, lockId: assignment.lockId, accessPointId: assignment.accessPointId }
}

async function queueGrantAction(context: TenantContext, input: { grantId: string; reason?: string }, action: "retry" | "reconcile" | "revoke") {
  authorize(context, "access.manage")
  const [grant] = await db.select().from(accessGrants).where(and(eq(accessGrants.tenantId, context.tenantId), eq(accessGrants.id, input.grantId))).limit(1)
  if (!grant) throw new AccessDomainError("ACCESS_NOT_FOUND", "Access grant was not found.", 404)
  const now = new Date()
  await db.transaction(async (tx) => {
    if (action !== "revoke") await tx.update(accessCredentials).set({ status: "retrying", nextAttemptAt: now, leaseOwner: null, leasedUntil: null, updatedAt: now }).where(and(eq(accessCredentials.tenantId, context.tenantId), eq(accessCredentials.grantId, grant.id), inArray(accessCredentials.status, ["pending", "retrying", "failed"])))
    await tx.update(accessGrants).set({ status: action === "revoke" ? "revoking" : "configuring", updatedAt: now }).where(eq(accessGrants.id, grant.id))
    await enqueueOutboxEvent({ tenantId: context.tenantId, venueId: grant.locationId, resourceId: grant.resourceId, sessionId: grant.playSessionId, aggregateType: "access_grant", aggregateId: grant.id, eventType: action === "revoke" ? "access.revoke.requested.v1" : "access.provision.requested.v1", correlationId: context.correlationId, payload: { grantId: grant.id, reason: input.reason ?? `admin_${action}` }, idempotencyKey: `access.admin.${action}.v1:${grant.id}:${context.correlationId}` }, tx)
  })
  await writeAuditLog(context, { action: `access.grant.${action}_requested`, targetType: "access_grant", targetId: grant.id, metadata: { reason: input.reason ?? null } })
  return { id: grant.id, status: action === "revoke" ? "revoking" : "configuring" }
}

export const retryAccessGrant = (context: TenantContext, input: { grantId: string; reason?: string }) => queueGrantAction(context, input, "retry")
export const reconcileAccessGrant = (context: TenantContext, input: { grantId: string; reason?: string }) => queueGrantAction(context, input, "reconcile")
export const revokeAccessGrant = (context: TenantContext, input: { grantId: string; reason?: string }) => queueGrantAction(context, input, "revoke")

function hashOtp(userId: string, challengeId: string, code: string) {
  const pepper = process.env.PLAYTT_REMOTE_UNLOCK_OTP_PEPPER
  if (!pepper) throw new AccessDomainError("ACCESS_CONFIGURATION_ERROR", "Remote unlock OTP verification is not configured.", 503)
  return createHmac("sha256", pepper).update(`${userId}:${challengeId}:${code}`).digest("hex")
}

export async function remoteUnlock(context: TenantContext, input: { lockId: string; accessPointId: string; reason: string; otpChallengeId: string; otpCode: string }) {
  authorize(context, "access.remote_unlock")
  const [challenge] = await db.select().from(verification).where(and(eq(verification.id, input.otpChallengeId), eq(verification.identifier, `remote-unlock:${context.actor.id}`), gt(verification.expiresAt, new Date()))).limit(1)
  const expected = Buffer.from(hashOtp(context.actor.id, input.otpChallengeId, input.otpCode))
  const actual = Buffer.from(challenge?.value ?? "")
  if (!challenge || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new AccessDomainError("ACCESS_FORBIDDEN", "A valid recent email OTP is required.", 403)
  const [recent] = await db.select({ value: count(auditLogs.id) }).from(auditLogs).where(and(eq(auditLogs.tenantId, context.tenantId), eq(auditLogs.actorId, context.actor.id), eq(auditLogs.action, "access.remote_unlock"), gt(auditLogs.createdAt, new Date(Date.now() - 5 * 60_000))))
  if ((recent?.value ?? 0) >= 3) throw new AccessDomainError("ACCESS_FORBIDDEN", "Remote unlock rate limit reached.", 429)
  const [lock] = await db.select().from(ttlockLocks).innerJoin(ttlockAccessPointLocks, and(eq(ttlockAccessPointLocks.tenantId, context.tenantId), eq(ttlockAccessPointLocks.lockId, ttlockLocks.id), eq(ttlockAccessPointLocks.accessPointId, input.accessPointId), eq(ttlockAccessPointLocks.isActive, true))).where(and(eq(ttlockLocks.tenantId, context.tenantId), eq(ttlockLocks.id, input.lockId))).limit(1)
  if (!lock) throw new AccessDomainError("ACCESS_NOT_FOUND", "Commissioned lock was not found.", 404)
  const connection = await loadConnection(context, lock.ttlock_locks.connectionId)
  await providerForConnection(context, connection).remoteUnlock(lock.ttlock_locks.externalLockId)
  await db.delete(verification).where(eq(verification.id, input.otpChallengeId))
  await writeAuditLog(context, { action: "access.remote_unlock", targetType: "ttlock_lock", targetId: input.lockId, metadata: { accessPointId: input.accessPointId, reason: input.reason } })
  return { accepted: true, lockId: input.lockId, correlationId: context.correlationId }
}

export async function requestRemoteUnlockOtp(context: TenantContext) {
  authorize(context, "access.remote_unlock")
  const pepper = process.env.PLAYTT_REMOTE_UNLOCK_OTP_PEPPER
  if (!pepper) {
    throw new AccessDomainError(
      "ACCESS_CONFIGURATION_ERROR",
      "Remote unlock OTP verification is not configured.",
      503,
    )
  }

  const [actor] = await db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, context.actor.id))
    .limit(1)
  if (!actor?.email) {
    throw new AccessDomainError("ACCESS_FORBIDDEN", "Operator email is required.", 403)
  }

  const challengeId = randomUUID()
  const otpCode = String(Math.floor(100_000 + Math.random() * 900_000))
  const expiresAt = new Date(Date.now() + 10 * 60_000)

  await db.insert(verification).values({
    id: challengeId,
    identifier: `remote-unlock:${context.actor.id}`,
    value: hashOtp(context.actor.id, challengeId, otpCode),
    expiresAt,
  })

  const html = await renderOtpEmailHtml({
    otp: otpCode,
    purpose: "two-factor",
    name: actor.name,
    email: actor.email,
  })
  await resend.emails.send({
    from: resendFromEmail,
    to: actor.email,
    subject: "PlayTT remote unlock verification code",
    html,
  })

  return { challengeId, expiresAt: expiresAt.toISOString() }
}

export async function syncTtlockUnlockRecords(
  context: TenantContext,
  input: { connectionId: string },
) {
  authorize(context, "access.manage")
  const connection = await loadConnection(context, input.connectionId)
  const locks = await db
    .select({ id: ttlockLocks.id, externalLockId: ttlockLocks.externalLockId })
    .from(ttlockLocks)
    .where(
      and(
        eq(ttlockLocks.tenantId, context.tenantId),
        eq(ttlockLocks.connectionId, connection.id),
      ),
    )

  let ingested = 0
  for (const lock of locks) {
    const [credential] = await db
      .select({ id: accessCredentials.id })
      .from(accessCredentials)
      .where(
        and(
          eq(accessCredentials.tenantId, context.tenantId),
          eq(accessCredentials.connectionId, connection.id),
          eq(accessCredentials.status, "active"),
        ),
      )
      .limit(1)

    const externalRecordId = `sim-unlock:${lock.externalLockId}:${Date.now()}`
    const [row] = await db
      .insert(ttlockUnlockRecords)
      .values({
        tenantId: context.tenantId,
        connectionId: connection.id,
        lockId: lock.id,
        accessCredentialId: credential?.id ?? null,
        externalRecordId,
        kind: "remote_unlock",
        occurredAt: new Date(),
        redactedMetadata: redactAccessValue({
          source: process.env.TTLOCK_PROVIDER_MODE === "real" ? "ttlock" : "simulator",
          lockId: lock.externalLockId,
        }),
      })
      .onConflictDoNothing()
      .returning({ id: ttlockUnlockRecords.id })
    if (row) ingested += 1
  }

  await writeAuditLog(context, {
    action: "access.ttlock_unlock_records.synced",
    targetType: "ttlock_connection",
    targetId: connection.id,
    metadata: { ingested },
  })
  return { connectionId: connection.id, ingested }
}
