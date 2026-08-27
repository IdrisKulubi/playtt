import { and, eq, inArray, lt } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  devices,
  locations,
  venueEdgeInstallations,
  venueEdgePairingSessions,
} from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import {
  generateVenueEdgePairingCode,
  hashVenueEdgePairingCode,
  normalizeVenueEdgePairingCode,
  verifyVenueEdgePairingCode,
} from "@/server/replays/venue-edge-pairing-credentials"
import {
  assertPairingCreateAllowed,
  recordFailedPairingLookup,
} from "@/server/replays/venue-edge-pairing-rate-limit"
import { derivePairingLifecycleStatus } from "@/server/replays/venue-edge-enrollment"
import type { VenueEdgeEnrollmentLifecycleStatus } from "@/server/replays/venue-edge-enrollment"
import { VENUE_EDGE_AUDIT_ACTIONS } from "@/server/replays/venue-edge-audit-actions"
import { writeAuditLogInTransaction } from "@/server/tenancy/audit-log-write"
import type { TenantContext } from "@/server/tenancy/types"

const DEFAULT_PAIRING_TTL_MINUTES = 15

export type VenueEdgePairingSessionStatus =
  | "waiting_for_install"
  | "cancelled"
  | "expired"
  | "consumed"

export interface VenueEdgePairingSessionView {
  id: string
  locationId: string
  status: VenueEdgePairingSessionStatus
  lifecycleStatus: VenueEdgeEnrollmentLifecycleStatus
  codeHint: string
  expiresAt: string
  cancelledAt: string | null
  consumedAt: string | null
  consumedDeviceId: string | null
  replaceInstallationId: string | null
  createdAt: string
}

export interface CreatedVenueEdgePairingSession extends VenueEdgePairingSessionView {
  pairingCode: string
}

function mapSessionRow(
  row: typeof venueEdgePairingSessions.$inferSelect,
  deviceStatus: string | null = null,
  lastHeartbeatAt: Date | null = null
): VenueEdgePairingSessionView {
  return {
    id: row.id,
    locationId: row.locationId,
    status: row.status,
    lifecycleStatus: derivePairingLifecycleStatus({
      pairingStatus: row.status,
      deviceStatus,
      lastHeartbeatAt,
    }),
    codeHint: row.codeHint,
    expiresAt: row.expiresAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    consumedAt: row.consumedAt?.toISOString() ?? null,
    consumedDeviceId: row.consumedDeviceId ?? null,
    replaceInstallationId: row.replaceInstallationId ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

async function assertLocationForTenant(tenantId: string, locationId: string) {
  const [location] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId)))
    .limit(1)

  if (!location) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Venue not found for this tenant.",
      404
    )
  }
}

async function assertReplaceInstallation(
  tenantId: string,
  locationId: string,
  replaceInstallationId: string
) {
  const [installation] = await db
    .select({ id: venueEdgeInstallations.id })
    .from(venueEdgeInstallations)
    .where(
      and(
        eq(venueEdgeInstallations.tenantId, tenantId),
        eq(venueEdgeInstallations.locationId, locationId),
        eq(venueEdgeInstallations.id, replaceInstallationId)
      )
    )
    .limit(1)

  if (!installation) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Replacement installation was not found for this venue.",
      404
    )
  }
}

async function expireStaleSessions(
  tenantId: string,
  locationId: string,
  now = new Date()
) {
  const expired = await db
    .update(venueEdgePairingSessions)
    .set({
      status: "expired",
      updatedAt: now,
    })
    .where(
      and(
        eq(venueEdgePairingSessions.tenantId, tenantId),
        eq(venueEdgePairingSessions.locationId, locationId),
        eq(venueEdgePairingSessions.status, "waiting_for_install"),
        lt(venueEdgePairingSessions.expiresAt, now)
      )
    )
    .returning({ id: venueEdgePairingSessions.id })

  return expired
}

async function cancelWaitingSessions(
  executor: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    tenantId: string
    locationId: string
    now: Date
    excludeSessionId?: string
  }
) {
  const conditions = [
    eq(venueEdgePairingSessions.tenantId, input.tenantId),
    eq(venueEdgePairingSessions.locationId, input.locationId),
    eq(venueEdgePairingSessions.status, "waiting_for_install"),
  ]

  await executor
    .update(venueEdgePairingSessions)
    .set({
      status: "cancelled",
      cancelledAt: input.now,
      updatedAt: input.now,
    })
    .where(and(...conditions))
}

async function getSessionForTenant(tenantId: string, sessionId: string) {
  const [session] = await db
    .select()
    .from(venueEdgePairingSessions)
    .where(
      and(
        eq(venueEdgePairingSessions.tenantId, tenantId),
        eq(venueEdgePairingSessions.id, sessionId)
      )
    )
    .limit(1)

  if (!session) {
    throw new DeviceError(
      "PAIRING_SESSION_NOT_FOUND",
      "Pairing session was not found.",
      404
    )
  }

  return session
}

export async function listVenueEdgePairingSessions(
  context: TenantContext,
  locationId: string
): Promise<VenueEdgePairingSessionView[]> {
  await assertLocationForTenant(context.tenantId, locationId)
  await expireStaleSessions(context.tenantId, locationId)

  const rows = await db
    .select({
      session: venueEdgePairingSessions,
      deviceStatus: devices.status,
      lastHeartbeatAt: devices.lastHeartbeatAt,
    })
    .from(venueEdgePairingSessions)
    .leftJoin(
      devices,
      eq(venueEdgePairingSessions.consumedDeviceId, devices.id)
    )
    .where(
      and(
        eq(venueEdgePairingSessions.tenantId, context.tenantId),
        eq(venueEdgePairingSessions.locationId, locationId),
        inArray(venueEdgePairingSessions.status, [
          "waiting_for_install",
          "cancelled",
          "expired",
          "consumed",
        ])
      )
    )
    .orderBy(venueEdgePairingSessions.createdAt)

  return rows.map((row) =>
    mapSessionRow(
      row.session,
      row.deviceStatus ?? null,
      row.lastHeartbeatAt ?? null
    )
  )
}

export async function createVenueEdgePairingSession(
  context: TenantContext,
  input: {
    locationId: string
    replaceInstallationId?: string | null
    expiresInMinutes?: number
  }
): Promise<CreatedVenueEdgePairingSession> {
  await assertLocationForTenant(context.tenantId, input.locationId)

  if (input.replaceInstallationId) {
    await assertReplaceInstallation(
      context.tenantId,
      input.locationId,
      input.replaceInstallationId
    )
  }

  const now = new Date()
  const expiresInMinutes = input.expiresInMinutes ?? DEFAULT_PAIRING_TTL_MINUTES
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000)
  const generated = generateVenueEdgePairingCode()

  const created = await db.transaction(async (tx) => {
    await assertPairingCreateAllowed(
      { tenantId: context.tenantId, locationId: input.locationId, now },
      tx
    )

    await cancelWaitingSessions(tx, {
      tenantId: context.tenantId,
      locationId: input.locationId,
      now,
    })

    const [row] = await tx
      .insert(venueEdgePairingSessions)
      .values({
        tenantId: context.tenantId,
        locationId: input.locationId,
        status: "waiting_for_install",
        codeHash: hashVenueEdgePairingCode(generated.pairingCode),
        codeHint: generated.codeHint,
        expiresAt,
        createdByActorId: context.actor.id,
        replaceInstallationId: input.replaceInstallationId ?? null,
        correlationId: context.correlationId,
      })
      .returning()

    await writeAuditLogInTransaction(tx, context, {
      action: VENUE_EDGE_AUDIT_ACTIONS.pairingCreated,
      targetType: "venue_edge_pairing_session",
      targetId: row.id,
      metadata: {
        locationId: input.locationId,
        expiresAt: expiresAt.toISOString(),
        replaceInstallationId: input.replaceInstallationId ?? null,
      },
    })

    return row
  })

  return {
    ...mapSessionRow(created),
    pairingCode: generated.pairingCode,
  }
}

export async function cancelVenueEdgePairingSession(
  context: TenantContext,
  sessionId: string
): Promise<VenueEdgePairingSessionView> {
  const now = new Date()

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(venueEdgePairingSessions)
      .set({
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(venueEdgePairingSessions.tenantId, context.tenantId),
          eq(venueEdgePairingSessions.id, sessionId),
          eq(venueEdgePairingSessions.status, "waiting_for_install")
        )
      )
      .returning()

    if (!row) {
      throw new DeviceError(
        "PAIRING_SESSION_INVALID",
        "Only waiting pairing sessions can be cancelled.",
        409
      )
    }

    await writeAuditLogInTransaction(tx, context, {
      action: VENUE_EDGE_AUDIT_ACTIONS.pairingCancelled,
      targetType: "venue_edge_pairing_session",
      targetId: row.id,
      metadata: {
        locationId: row.locationId,
      },
    })

    return row
  })

  return mapSessionRow(updated)
}

export async function reissueVenueEdgePairingSession(
  context: TenantContext,
  sessionId: string
): Promise<CreatedVenueEdgePairingSession> {
  const session = await getSessionForTenant(context.tenantId, sessionId)

  if (session.status !== "waiting_for_install") {
    throw new DeviceError(
      "PAIRING_SESSION_INVALID",
      "Only waiting pairing sessions can be reissued.",
      409
    )
  }

  const cancelled = await cancelVenueEdgePairingSession(context, sessionId)

  const created = await createVenueEdgePairingSession(context, {
    locationId: cancelled.locationId,
    replaceInstallationId: cancelled.replaceInstallationId,
  })

  await db.transaction(async (tx) => {
    await writeAuditLogInTransaction(tx, context, {
      action: VENUE_EDGE_AUDIT_ACTIONS.pairingReissued,
      targetType: "venue_edge_pairing_session",
      targetId: created.id,
      metadata: {
        locationId: created.locationId,
        previousSessionId: sessionId,
        replaceInstallationId: created.replaceInstallationId,
        expiresAt: created.expiresAt,
      },
    })
  })

  return created
}

export async function resolveVenueEdgePairingSessionFromCode(input: {
  tenantId: string
  locationId: string
  pairingCode: string
  lookupSubject?: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  const normalized = normalizeVenueEdgePairingCode(input.pairingCode)
  const lookupSubject =
    input.lookupSubject ??
    `tenant:${input.tenantId}:code:${normalized.slice(0, 4)}`

  const [session] = await db
    .select()
    .from(venueEdgePairingSessions)
    .where(
      and(
        eq(venueEdgePairingSessions.tenantId, input.tenantId),
        eq(
          venueEdgePairingSessions.codeHash,
          hashVenueEdgePairingCode(normalized)
        )
      )
    )
    .limit(1)

  if (!session) {
    await recordFailedPairingLookup({ subject: lookupSubject, now })
    return null
  }

  if (session.locationId !== input.locationId) {
    await recordFailedPairingLookup({ subject: lookupSubject, now })
    return null
  }

  if (!verifyVenueEdgePairingCode(normalized, session.codeHash)) {
    await recordFailedPairingLookup({ subject: lookupSubject, now })
    return null
  }

  if (session.status === "cancelled") {
    throw new DeviceError(
      "PAIRING_SESSION_INVALID",
      "Pairing code has been cancelled.",
      403
    )
  }

  if (session.status === "consumed") {
    throw new DeviceError(
      "PAIRING_SESSION_INVALID",
      "Pairing code has already been used.",
      403
    )
  }

  if (session.status === "expired" || session.expiresAt <= now) {
    if (session.status === "waiting_for_install") {
      await db
        .update(venueEdgePairingSessions)
        .set({ status: "expired", updatedAt: now })
        .where(eq(venueEdgePairingSessions.id, session.id))
    }

    throw new DeviceError(
      "PAIRING_SESSION_INVALID",
      "Pairing code has expired.",
      403
    )
  }

  if (session.status !== "waiting_for_install") {
    throw new DeviceError(
      "PAIRING_SESSION_INVALID",
      "Pairing code is not available.",
      403
    )
  }

  return mapSessionRow(session)
}
