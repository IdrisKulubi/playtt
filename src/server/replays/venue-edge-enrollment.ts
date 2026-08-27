import { randomUUID } from "node:crypto"

import { and, eq, gt, isNull } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  deviceAssignments,
  deviceCredentials,
  deviceHeartbeats,
  devices,
  venueEdgeInstallations,
  venueEdgePairingSessions,
} from "@/db/schema"
import type { AuthenticatedDevice } from "@/server/devices/auth"
import {
  generateDeviceSecret,
  hashDeviceSecret,
} from "@/server/devices/credentials"
import { DeviceError } from "@/server/devices/errors"
import { validateDeviceAssignmentPolicy } from "@/server/devices/policies.mjs"
import {
  hashVenueEdgePairingCode,
  normalizeVenueEdgePairingCode,
} from "@/server/replays/venue-edge-pairing-credentials"
import { recordFailedPairingLookup } from "@/server/replays/venue-edge-pairing-rate-limit"
import { VENUE_EDGE_AUDIT_ACTIONS } from "@/server/replays/venue-edge-audit-actions"
import { createServiceTenantContext } from "@/server/tenancy/context-factory.mjs"
import { writeAuditLogInTransaction } from "@/server/tenancy/audit-log-write"

export type VenueEdgeEnrollmentLifecycleStatus =
  | "waiting_for_install"
  | "cancelled"
  | "expired"
  | "pending_setup"
  | "online"
  | "revoked"

export interface VenueEdgeEnrollmentExchangeResult {
  deviceId: string
  secret: string
  credentialVersion: number
  installationId: string
  tenantId: string
  locationId: string
  status: "pending_setup"
}

export interface VenueEdgeEnrollmentConfirmResult {
  deviceId: string
  status: "online"
  alreadyConfirmed: boolean
}

type EnrollmentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

function invalidPairingCodeError() {
  return new DeviceError(
    "PAIRING_SESSION_INVALID",
    "Pairing code is invalid.",
    403,
  )
}

async function revokeDeviceInTransaction(
  tx: EnrollmentTransaction,
  tenantId: string,
  deviceId: string,
  now: Date,
) {
  await tx
    .update(devices)
    .set({ status: "revoked", updatedAt: now })
    .where(and(eq(devices.tenantId, tenantId), eq(devices.id, deviceId)))

  await tx
    .update(deviceCredentials)
    .set({
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(deviceCredentials.tenantId, tenantId),
        eq(deviceCredentials.deviceId, deviceId),
        eq(deviceCredentials.status, "active"),
      ),
    )

  await tx
    .update(deviceAssignments)
    .set({
      effectiveTo: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(deviceAssignments.tenantId, tenantId),
        eq(deviceAssignments.deviceId, deviceId),
        isNull(deviceAssignments.effectiveTo),
      ),
    )
}

async function assertInstallationUidAvailable(
  tenantId: string,
  installationUid: string,
) {
  const [existing] = await db
    .select({ id: venueEdgeInstallations.id })
    .from(venueEdgeInstallations)
    .where(
      and(
        eq(venueEdgeInstallations.tenantId, tenantId),
        eq(venueEdgeInstallations.installationUid, installationUid),
      ),
    )
    .limit(1)

  if (existing) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Installation ID has already enrolled.",
      409,
    )
  }
}

export async function exchangeVenueEdgeEnrollment(input: {
  pairingCode: string
  installationUid: string
  platform: string
  architecture: string
  agentVersion: string
  displayName?: string | null
  lookupSubject: string
  correlationId: string
}): Promise<VenueEdgeEnrollmentExchangeResult> {
  const now = new Date()
  const normalized = normalizeVenueEdgePairingCode(input.pairingCode)
  const codeHash = hashVenueEdgePairingCode(normalized)

  const [session] = await db
    .select()
    .from(venueEdgePairingSessions)
    .where(eq(venueEdgePairingSessions.codeHash, codeHash))
    .limit(1)

  if (!session) {
    await recordFailedPairingLookup({ subject: input.lookupSubject, now })
    throw invalidPairingCodeError()
  }

  if (session.status === "cancelled") {
    throw invalidPairingCodeError()
  }

  if (session.status === "consumed") {
    throw invalidPairingCodeError()
  }

  if (session.status === "expired" || session.expiresAt <= now) {
    if (session.status === "waiting_for_install") {
      await db
        .update(venueEdgePairingSessions)
        .set({ status: "expired", updatedAt: now })
        .where(eq(venueEdgePairingSessions.id, session.id))
    }

    throw invalidPairingCodeError()
  }

  if (session.status !== "waiting_for_install") {
    throw invalidPairingCodeError()
  }

  await assertInstallationUidAvailable(session.tenantId, input.installationUid)

  const deviceId = randomUUID()
  const secret = generateDeviceSecret()
  const secretHash = hashDeviceSecret(secret)
  const displayName =
    input.displayName?.trim() ||
    `VenueEdge ${input.platform} ${input.architecture}`
  let installationId = ""

  const auditContext = createServiceTenantContext({
    tenantId: session.tenantId,
    actorId: "venue-edge-enrollment",
    correlationId: input.correlationId,
  })

  await db.transaction(async (tx) => {
    const consumed = await tx
      .update(venueEdgePairingSessions)
      .set({
        status: "consumed",
        consumedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(venueEdgePairingSessions.id, session.id),
          eq(venueEdgePairingSessions.status, "waiting_for_install"),
          gt(venueEdgePairingSessions.expiresAt, now),
        ),
      )
      .returning()

    if (consumed.length === 0) {
      throw invalidPairingCodeError()
    }

    if (session.replaceInstallationId) {
      const [replacement] = await tx
        .select({
          edgeDeviceId: venueEdgeInstallations.edgeDeviceId,
        })
        .from(venueEdgeInstallations)
        .where(
          and(
            eq(venueEdgeInstallations.tenantId, session.tenantId),
            eq(venueEdgeInstallations.id, session.replaceInstallationId),
          ),
        )
        .limit(1)

      if (replacement) {
        await revokeDeviceInTransaction(
          tx,
          session.tenantId,
          replacement.edgeDeviceId,
          now,
        )
      }
    }

    await tx.insert(devices).values({
      id: deviceId,
      tenantId: session.tenantId,
      locationId: session.locationId,
      type: "venue_edge",
      hardwareUid: input.installationUid,
      firmwareVersion: input.agentVersion,
      status: "pending",
      capabilityCodes: ["replay"],
    })

    await tx.insert(deviceCredentials).values({
      tenantId: session.tenantId,
      deviceId,
      version: 1,
      secretHash,
      status: "active",
    })

    const policy = validateDeviceAssignmentPolicy({
      role: "venue_edge",
      deviceType: "venue_edge",
      deviceCapabilityCodes: ["replay"],
      resourceId: null,
      resourceCapabilityCodes: [],
    })

    if (!policy.ok) {
      throw new DeviceError(
        "DEVICE_ROLE_UNSUPPORTED",
        `VenueEdge assignment is incompatible (${policy.reason}).`,
        400,
      )
    }

    await tx.insert(deviceAssignments).values({
      tenantId: session.tenantId,
      deviceId,
      locationId: session.locationId,
      resourceId: null,
      role: "venue_edge",
      effectiveFrom: now,
      config: {},
      configVersion: 1,
    })

    const [installation] = await tx
      .insert(venueEdgeInstallations)
      .values({
        tenantId: session.tenantId,
        locationId: session.locationId,
        edgeDeviceId: deviceId,
        installationUid: input.installationUid,
        displayName,
        platform: input.platform,
        architecture: input.architecture,
        currentAgentVersion: input.agentVersion,
        installedAt: now,
      })
      .returning({ id: venueEdgeInstallations.id })

    installationId = installation.id

    await tx
      .update(venueEdgePairingSessions)
      .set({
        consumedDeviceId: deviceId,
        updatedAt: now,
      })
      .where(eq(venueEdgePairingSessions.id, session.id))

    await writeAuditLogInTransaction(tx, auditContext, {
      action: VENUE_EDGE_AUDIT_ACTIONS.pairingConsumed,
      targetType: "venue_edge_pairing_session",
      targetId: session.id,
      metadata: {
        locationId: session.locationId,
        installationUid: input.installationUid,
        deviceId,
        replaceInstallationId: session.replaceInstallationId ?? null,
      },
    })
  })

  return {
    deviceId,
    secret,
    credentialVersion: 1,
    installationId: installationId,
    tenantId: session.tenantId,
    locationId: session.locationId,
    status: "pending_setup",
  }
}

export async function confirmVenueEdgeEnrollment(
  auth: AuthenticatedDevice,
): Promise<VenueEdgeEnrollmentConfirmResult> {
  if (auth.device.type !== "venue_edge") {
    throw new DeviceError(
      "DEVICE_FORBIDDEN",
      "Only VenueEdge devices can confirm enrollment.",
      403,
    )
  }

  if (auth.device.status === "revoked") {
    throw new DeviceError("DEVICE_REVOKED", "Device has been revoked.", 403)
  }

  if (auth.device.status === "active") {
    return {
      deviceId: auth.device.id,
      status: "online",
      alreadyConfirmed: true,
    }
  }

  if (auth.device.status !== "pending") {
    throw new DeviceError(
      "PAIRING_SESSION_INVALID",
      "Device is not awaiting enrollment confirmation.",
      409,
    )
  }

  const [heartbeat] = await db
    .select({ id: deviceHeartbeats.id })
    .from(deviceHeartbeats)
    .where(eq(deviceHeartbeats.deviceId, auth.device.id))
    .limit(1)

  if (!heartbeat) {
    throw new DeviceError(
      "PAIRING_HEARTBEAT_REQUIRED",
      "Enrollment confirmation requires at least one heartbeat.",
      409,
    )
  }

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(devices)
      .set({
        status: "active",
        updatedAt: now,
      })
      .where(
        and(
          eq(devices.tenantId, auth.device.tenantId),
          eq(devices.id, auth.device.id),
          eq(devices.status, "pending"),
        ),
      )

    await writeAuditLogInTransaction(tx, auth.context, {
      action: VENUE_EDGE_AUDIT_ACTIONS.pairingConfirmed,
      targetType: "device",
      targetId: auth.device.id,
      metadata: {
        locationId: auth.device.locationId,
        installationUid: auth.device.hardwareUid,
      },
    })
  })

  return {
    deviceId: auth.device.id,
    status: "online",
    alreadyConfirmed: false,
  }
}

export function derivePairingLifecycleStatus(input: {
  pairingStatus: string
  deviceStatus: string | null
}): VenueEdgeEnrollmentLifecycleStatus {
  if (input.pairingStatus === "waiting_for_install") {
    return "waiting_for_install"
  }

  if (input.pairingStatus === "cancelled") {
    return "cancelled"
  }

  if (input.pairingStatus === "expired") {
    return "expired"
  }

  if (input.deviceStatus === "revoked") {
    return "revoked"
  }

  if (input.pairingStatus === "consumed") {
    if (input.deviceStatus === "pending") {
      return "pending_setup"
    }

    if (input.deviceStatus === "active") {
      return "online"
    }
  }

  return "waiting_for_install"
}
