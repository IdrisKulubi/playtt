import { randomUUID } from "node:crypto"

import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, or } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  accessCredentials,
  deviceAssignments,
  deviceCommandAcks,
  deviceCommands,
  deviceCredentials,
  deviceEnrollments,
  deviceHeartbeats,
  devices,
  locations,
  relayChannels,
  replayCameraSources,
  replayRequests,
  resourceCapabilities,
  resources,
  scoreEvents,
  ttlockGateways,
  ttlockLocks,
  venueEdgeInstallations,
  venueEdgePairingSessions,
} from "@/db/schema"
import type {
  deviceAssignmentRoleEnum,
  deviceStatusEnum,
  deviceTypeEnum,
} from "@/db/schema"
import {
  generateDeviceSecret,
  generateEnrollmentCode,
  hashDeviceSecret,
  hashEnrollmentCode,
  verifyEnrollmentCode,
  verifyDeviceSecret,
} from "@/server/devices/credentials"
import { DeviceError } from "@/server/devices/errors"
import { validateDeviceAssignmentPolicy } from "@/server/devices/policies.mjs"
import {
  deriveDeviceHealth,
  type DeviceHealthStatus,
} from "@/server/devices/health-policy"
import type { TenantContext } from "@/server/tenancy/types"

export type DeviceType = (typeof deviceTypeEnum.enumValues)[number]
export type DeviceStatus = (typeof deviceStatusEnum.enumValues)[number]
export type DeviceAssignmentRole =
  (typeof deviceAssignmentRoleEnum.enumValues)[number]

export interface DeviceRecord {
  id: string
  tenantId: string
  locationId: string
  type: DeviceType
  hardwareUid: string
  firmwareVersion: string | null
  status: DeviceStatus
  capabilityCodes: string[]
  lastSeenAt: string | null
  lastHeartbeatAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DeviceEnrollmentRecord {
  id: string
  tenantId: string
  locationId: string
  deviceType: DeviceType
  expiresAt: string
  consumedAt: string | null
  consumedDeviceId: string | null
  correlationId: string
  createdAt: string
}

export interface DeviceAssignmentRecord {
  id: string
  tenantId: string
  deviceId: string
  locationId: string
  resourceId: string | null
  role: DeviceAssignmentRole
  effectiveFrom: string
  effectiveTo: string | null
  config: Record<string, unknown>
  configVersion: number
  appliedConfigVersion: number | null
  createdAt: string
  updatedAt: string
}

export interface DeviceListItem extends DeviceRecord {
  currentAssignment: DeviceAssignmentRecord | null
  health: DeviceHealthStatus
}

function mapDevice(row: typeof devices.$inferSelect): DeviceRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    locationId: row.locationId,
    type: row.type,
    hardwareUid: row.hardwareUid,
    firmwareVersion: row.firmwareVersion,
    status: row.status,
    capabilityCodes: row.capabilityCodes ?? [],
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    lastHeartbeatAt: row.lastHeartbeatAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapAssignment(
  row: typeof deviceAssignments.$inferSelect
): DeviceAssignmentRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    deviceId: row.deviceId,
    locationId: row.locationId,
    resourceId: row.resourceId,
    role: row.role,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    config: row.config ?? {},
    configVersion: row.configVersion,
    appliedConfigVersion: row.appliedConfigVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listDevices(
  context: TenantContext,
  locationId?: string
): Promise<DeviceListItem[]> {
  const rows = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.tenantId, context.tenantId),
        locationId ? eq(devices.locationId, locationId) : undefined
      )
    )
    .orderBy(asc(devices.hardwareUid))

  const now = new Date()
  const items: DeviceListItem[] = []

  for (const row of rows) {
    const [assignment] = await db
      .select()
      .from(deviceAssignments)
      .where(
        and(
          eq(deviceAssignments.tenantId, context.tenantId),
          eq(deviceAssignments.deviceId, row.id),
          lte(deviceAssignments.effectiveFrom, now),
          or(
            isNull(deviceAssignments.effectiveTo),
            gt(deviceAssignments.effectiveTo, now)
          )
        )
      )
      .orderBy(desc(deviceAssignments.effectiveFrom))
      .limit(1)

    items.push({
      ...mapDevice(row),
      currentAssignment: assignment ? mapAssignment(assignment) : null,
      health: deriveDeviceHealth(row.lastHeartbeatAt),
    })
  }

  return items
}

export async function createEnrollment(
  context: TenantContext,
  input: {
    locationId: string
    deviceType: DeviceType
    expiresInMinutes?: number
  }
): Promise<{
  enrollmentId: string
  enrollmentCode: string
  expiresAt: string
}> {
  const [location] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, context.tenantId),
        eq(locations.id, input.locationId)
      )
    )
    .limit(1)

  if (!location) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Venue not found for this tenant.",
      400
    )
  }

  const enrollmentCode = generateEnrollmentCode()
  const codeHash = hashEnrollmentCode(enrollmentCode)
  const expiresInMinutes = input.expiresInMinutes ?? 30
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000)

  const [created] = await db
    .insert(deviceEnrollments)
    .values({
      tenantId: context.tenantId,
      locationId: input.locationId,
      deviceType: input.deviceType,
      codeHash,
      expiresAt,
      correlationId: context.correlationId,
    })
    .returning({ id: deviceEnrollments.id })

  return {
    enrollmentId: created.id,
    enrollmentCode,
    expiresAt: expiresAt.toISOString(),
  }
}

export async function issueProvisionedDevice(
  context: TenantContext,
  input: {
    locationId: string
    deviceType: DeviceType
    hardwareUid?: string
    expiresInMinutes?: number
  },
): Promise<{
  deviceId: string
  secret: string
  credentialVersion: number
  hardwareUid: string
  deviceType: DeviceType
}> {
  const enrollment = await createEnrollment(context, {
    locationId: input.locationId,
    deviceType: input.deviceType,
    expiresInMinutes: input.expiresInMinutes,
  })
  const hardwareUid =
    input.hardwareUid?.trim() || `${input.deviceType}-${randomUUID()}`
  const provisioned = await provisionDevice({
    enrollmentCode: enrollment.enrollmentCode,
    hardwareUid,
    firmwareVersion: "operator-issued",
    correlationId: context.correlationId,
  })

  return {
    deviceId: provisioned.deviceId,
    secret: provisioned.secret,
    credentialVersion: provisioned.credentialVersion,
    hardwareUid,
    deviceType: input.deviceType,
  }
}

export async function provisionDevice(input: {
  enrollmentCode: string
  hardwareUid: string
  firmwareVersion?: string | null
  correlationId: string
}): Promise<{
  deviceId: string
  secret: string
  credentialVersion: number
  tenantId: string
}> {
  const codeHash = hashEnrollmentCode(input.enrollmentCode)

  const [enrollment] = await db
    .select()
    .from(deviceEnrollments)
    .where(eq(deviceEnrollments.codeHash, codeHash))
    .limit(1)

  if (!enrollment) {
    throw new DeviceError(
      "ENROLLMENT_INVALID",
      "Enrollment code is invalid.",
      403
    )
  }

  if (enrollment.consumedAt) {
    throw new DeviceError(
      "ENROLLMENT_CONSUMED",
      "Enrollment code has already been used.",
      403
    )
  }

  if (enrollment.expiresAt <= new Date()) {
    throw new DeviceError(
      "ENROLLMENT_EXPIRED",
      "Enrollment code has expired.",
      403
    )
  }

  const secret = generateDeviceSecret()
  const secretHash = hashDeviceSecret(secret)
  const deviceId = randomUUID()

  await db.transaction(async (tx) => {
    await tx.insert(devices).values({
      id: deviceId,
      tenantId: enrollment.tenantId,
      locationId: enrollment.locationId,
      type: enrollment.deviceType,
      hardwareUid: input.hardwareUid,
      firmwareVersion: input.firmwareVersion ?? null,
      status: "active",
      capabilityCodes:
        enrollment.deviceType === "venue_edge"
          ? ["replay"]
          : enrollment.deviceType === "camera"
            ? ["camera"]
            : [],
    })

    await tx.insert(deviceCredentials).values({
      tenantId: enrollment.tenantId,
      deviceId,
      version: 1,
      secretHash,
      status: "active",
    })

    const consumed = await tx
      .update(deviceEnrollments)
      .set({
        consumedAt: new Date(),
        consumedDeviceId: deviceId,
      })
      .where(
        and(
          eq(deviceEnrollments.id, enrollment.id),
          isNull(deviceEnrollments.consumedAt),
          gt(deviceEnrollments.expiresAt, new Date())
        )
      )
      .returning({ id: deviceEnrollments.id })

    if (consumed.length === 0) {
      throw new DeviceError(
        "ENROLLMENT_CONSUMED",
        "Enrollment code is no longer available.",
        403
      )
    }
  })

  return {
    deviceId,
    secret,
    credentialVersion: 1,
    tenantId: enrollment.tenantId,
  }
}

export async function authenticateDeviceCredential(input: {
  deviceId: string
  secret: string
}): Promise<{
  device: DeviceRecord
  credentialVersion: number
}> {
  const [device] = await db
    .select()
    .from(devices)
    .where(eq(devices.id, input.deviceId))
    .limit(1)

  if (!device) {
    throw new DeviceError("DEVICE_NOT_FOUND", "Device not found.", 401)
  }

  if (device.status === "revoked") {
    throw new DeviceError("DEVICE_REVOKED", "Device has been revoked.", 403)
  }

  const credentials = await db
    .select()
    .from(deviceCredentials)
    .where(
      and(
        eq(deviceCredentials.deviceId, input.deviceId),
        inArray(deviceCredentials.status, ["active", "retiring"])
      )
    )

  const credential = credentials.find((row) =>
    verifyDeviceSecret(input.secret, row.secretHash)
  )

  if (!credential) {
    throw new DeviceError(
      "DEVICE_UNAUTHENTICATED",
      "Device credentials are invalid.",
      401
    )
  }

  return {
    device: mapDevice(device),
    credentialVersion: credential.version,
  }
}

export async function rotateDeviceCredential(input: {
  deviceId: string
  tenantId: string
}): Promise<{
  secret: string
  credentialVersion: number
  previousVersion: number
}> {
  const secret = generateDeviceSecret()
  const secretHash = hashDeviceSecret(secret)

  const rotated = await db.transaction(async (tx) => {
    const [active] = await tx
      .select()
      .from(deviceCredentials)
      .where(
        and(
          eq(deviceCredentials.deviceId, input.deviceId),
          eq(deviceCredentials.tenantId, input.tenantId),
          eq(deviceCredentials.status, "active")
        )
      )
      .limit(1)

    if (!active) {
      throw new DeviceError(
        "DEVICE_NOT_FOUND",
        "Active device credential not found.",
        404
      )
    }

    const nextVersion = active.version + 1
    const now = new Date()

    await tx
      .update(deviceCredentials)
      .set({
        status: "retiring",
        updatedAt: now,
      })
      .where(eq(deviceCredentials.id, active.id))

    await tx.insert(deviceCredentials).values({
      tenantId: input.tenantId,
      deviceId: input.deviceId,
      version: nextVersion,
      secretHash,
      status: "active",
    })

    return {
      nextVersion,
      previousVersion: active.version,
    }
  })

  return {
    secret,
    credentialVersion: rotated.nextVersion,
    previousVersion: rotated.previousVersion,
  }
}

export async function acknowledgeDeviceCredentialRotation(input: {
  deviceId: string
  tenantId: string
  credentialVersion: number
}): Promise<{ credentialVersion: number; previousVersion: number | null }> {
  const now = new Date()

  return await db.transaction(async (tx) => {
    const [active] = await tx
      .select()
      .from(deviceCredentials)
      .where(
        and(
          eq(deviceCredentials.deviceId, input.deviceId),
          eq(deviceCredentials.tenantId, input.tenantId),
          eq(deviceCredentials.status, "active"),
          eq(deviceCredentials.version, input.credentialVersion)
        )
      )
      .limit(1)

    if (!active) {
      throw new DeviceError(
        "DEVICE_NOT_FOUND",
        "Active rotated credential was not found.",
        404
      )
    }

    const [retiring] = await tx
      .select()
      .from(deviceCredentials)
      .where(
        and(
          eq(deviceCredentials.deviceId, input.deviceId),
          eq(deviceCredentials.tenantId, input.tenantId),
          eq(deviceCredentials.status, "retiring")
        )
      )
      .limit(1)

    if (!retiring) {
      return {
        credentialVersion: active.version,
        previousVersion: null,
      }
    }

    await tx
      .update(deviceCredentials)
      .set({
        status: "rotated",
        rotatedAt: now,
        updatedAt: now,
      })
      .where(eq(deviceCredentials.id, retiring.id))

    return {
      credentialVersion: active.version,
      previousVersion: retiring.version,
    }
  })
}

export async function rollbackDeviceCredentialRotation(input: {
  deviceId: string
  tenantId: string
  credentialVersion: number
}): Promise<{ credentialVersion: number; rolledBackVersion: number }> {
  const now = new Date()

  return await db.transaction(async (tx) => {
    const [retiring] = await tx
      .select()
      .from(deviceCredentials)
      .where(
        and(
          eq(deviceCredentials.deviceId, input.deviceId),
          eq(deviceCredentials.tenantId, input.tenantId),
          eq(deviceCredentials.status, "retiring"),
          eq(deviceCredentials.version, input.credentialVersion)
        )
      )
      .limit(1)

    if (!retiring) {
      throw new DeviceError(
        "DEVICE_NOT_FOUND",
        "Retiring credential was not found for rollback.",
        404
      )
    }

    const [active] = await tx
      .select()
      .from(deviceCredentials)
      .where(
        and(
          eq(deviceCredentials.deviceId, input.deviceId),
          eq(deviceCredentials.tenantId, input.tenantId),
          eq(deviceCredentials.status, "active")
        )
      )
      .limit(1)

    if (!active) {
      throw new DeviceError(
        "DEVICE_NOT_FOUND",
        "Active credential was not found for rollback.",
        404
      )
    }

    await tx
      .update(deviceCredentials)
      .set({
        status: "revoked",
        revokedAt: now,
        updatedAt: now,
      })
      .where(eq(deviceCredentials.id, active.id))

    await tx
      .update(deviceCredentials)
      .set({
        status: "active",
        updatedAt: now,
      })
      .where(eq(deviceCredentials.id, retiring.id))

    return {
      credentialVersion: retiring.version,
      rolledBackVersion: active.version,
    }
  })
}

export async function revokeDevice(
  context: TenantContext,
  deviceId: string
): Promise<DeviceRecord> {
  const now = new Date()

  const [device] = await db
    .update(devices)
    .set({ status: "revoked", updatedAt: now })
    .where(
      and(eq(devices.tenantId, context.tenantId), eq(devices.id, deviceId))
    )
    .returning()

  if (!device) {
    throw new DeviceError("DEVICE_NOT_FOUND", "Device not found.", 404)
  }

  await db
    .update(deviceCredentials)
    .set({
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(deviceCredentials.tenantId, context.tenantId),
        eq(deviceCredentials.deviceId, deviceId),
        eq(deviceCredentials.status, "active")
      )
    )

  await db
    .update(deviceAssignments)
    .set({
      effectiveTo: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(deviceAssignments.tenantId, context.tenantId),
        eq(deviceAssignments.deviceId, deviceId),
        isNull(deviceAssignments.effectiveTo)
      )
    )

  return mapDevice(device)
}

export async function deleteDevice(
  context: TenantContext,
  deviceId: string
): Promise<{ id: string; hardwareUid: string }> {
  return db.transaction(async (tx) => {
    const [device] = await tx
      .select({
        id: devices.id,
        hardwareUid: devices.hardwareUid,
      })
      .from(devices)
      .where(
        and(eq(devices.tenantId, context.tenantId), eq(devices.id, deviceId))
      )
      .limit(1)

    if (!device) {
      throw new DeviceError("DEVICE_NOT_FOUND", "Device not found.", 404)
    }

    const [scoreEvent] = await tx
      .select({ id: scoreEvents.id })
      .from(scoreEvents)
      .where(eq(scoreEvents.deviceId, deviceId))
      .limit(1)

    if (scoreEvent) {
      throw new DeviceError(
        "DEVICE_IN_USE",
        "This device recorded score events and cannot be deleted.",
        409
      )
    }

    const [credential] = await tx
      .select({ id: accessCredentials.id })
      .from(accessCredentials)
      .where(eq(accessCredentials.lockDeviceId, deviceId))
      .limit(1)

    if (credential) {
      throw new DeviceError(
        "DEVICE_IN_USE",
        "This lock still has access credentials and cannot be deleted.",
        409
      )
    }

    const [relay] = await tx
      .select({ id: relayChannels.id })
      .from(relayChannels)
      .where(
        and(
          eq(relayChannels.tenantId, context.tenantId),
          eq(relayChannels.deviceId, deviceId)
        )
      )
      .limit(1)

    if (relay) {
      throw new DeviceError(
        "DEVICE_IN_USE",
        "This device still has relay channels and cannot be deleted.",
        409
      )
    }

    await tx
      .update(deviceEnrollments)
      .set({ consumedDeviceId: null })
      .where(
        and(
          eq(deviceEnrollments.tenantId, context.tenantId),
          eq(deviceEnrollments.consumedDeviceId, deviceId)
        )
      )

    await tx
      .update(replayCameraSources)
      .set({ cameraDeviceId: null })
      .where(
        and(
          eq(replayCameraSources.tenantId, context.tenantId),
          eq(replayCameraSources.cameraDeviceId, deviceId)
        )
      )

    await tx
      .update(replayRequests)
      .set({ venueEdgeDeviceId: null })
      .where(
        and(
          eq(replayRequests.tenantId, context.tenantId),
          eq(replayRequests.venueEdgeDeviceId, deviceId)
        )
      )

    await tx
      .update(replayRequests)
      .set({ cameraDeviceId: null })
      .where(
        and(
          eq(replayRequests.tenantId, context.tenantId),
          eq(replayRequests.cameraDeviceId, deviceId)
        )
      )

    const assignmentRows = await tx
      .select({ id: deviceAssignments.id })
      .from(deviceAssignments)
      .where(
        and(
          eq(deviceAssignments.tenantId, context.tenantId),
          eq(deviceAssignments.deviceId, deviceId)
        )
      )

    if (assignmentRows.length > 0) {
      await tx
        .update(replayRequests)
        .set({ assignmentId: null })
        .where(
          and(
            eq(replayRequests.tenantId, context.tenantId),
            inArray(
              replayRequests.assignmentId,
              assignmentRows.map((row) => row.id)
            )
          )
        )
    }

    const commandRows = await tx
      .select({ id: deviceCommands.id })
      .from(deviceCommands)
      .where(
        and(
          eq(deviceCommands.tenantId, context.tenantId),
          eq(deviceCommands.deviceId, deviceId)
        )
      )

    if (commandRows.length > 0) {
      await tx
        .update(replayRequests)
        .set({ deviceCommandId: null })
        .where(
          and(
            eq(replayRequests.tenantId, context.tenantId),
            inArray(
              replayRequests.deviceCommandId,
              commandRows.map((row) => row.id)
            )
          )
        )
    }

    const installationRows = await tx
      .select({ id: venueEdgeInstallations.id })
      .from(venueEdgeInstallations)
      .where(
        and(
          eq(venueEdgeInstallations.tenantId, context.tenantId),
          eq(venueEdgeInstallations.edgeDeviceId, deviceId)
        )
      )

    if (installationRows.length > 0) {
      await tx
        .update(venueEdgePairingSessions)
        .set({ replaceInstallationId: null })
        .where(
          and(
            eq(venueEdgePairingSessions.tenantId, context.tenantId),
            inArray(
              venueEdgePairingSessions.replaceInstallationId,
              installationRows.map((row) => row.id)
            )
          )
        )
    }

    await tx
      .update(ttlockGateways)
      .set({ deviceId: null })
      .where(
        and(
          eq(ttlockGateways.tenantId, context.tenantId),
          eq(ttlockGateways.deviceId, deviceId)
        )
      )

    await tx
      .update(ttlockLocks)
      .set({ deviceId: null })
      .where(
        and(
          eq(ttlockLocks.tenantId, context.tenantId),
          eq(ttlockLocks.deviceId, deviceId)
        )
      )

    await tx
      .delete(venueEdgePairingSessions)
      .where(
        and(
          eq(venueEdgePairingSessions.tenantId, context.tenantId),
          eq(venueEdgePairingSessions.consumedDeviceId, deviceId)
        )
      )

    await tx
      .delete(deviceCommandAcks)
      .where(
        and(
          eq(deviceCommandAcks.tenantId, context.tenantId),
          eq(deviceCommandAcks.deviceId, deviceId)
        )
      )

    await tx
      .delete(deviceCommands)
      .where(
        and(
          eq(deviceCommands.tenantId, context.tenantId),
          eq(deviceCommands.deviceId, deviceId)
        )
      )

    await tx
      .delete(deviceHeartbeats)
      .where(
        and(
          eq(deviceHeartbeats.tenantId, context.tenantId),
          eq(deviceHeartbeats.deviceId, deviceId)
        )
      )

    await tx
      .delete(deviceCredentials)
      .where(
        and(
          eq(deviceCredentials.tenantId, context.tenantId),
          eq(deviceCredentials.deviceId, deviceId)
        )
      )

    await tx
      .delete(deviceAssignments)
      .where(
        and(
          eq(deviceAssignments.tenantId, context.tenantId),
          eq(deviceAssignments.deviceId, deviceId)
        )
      )

    try {
      await tx
        .delete(devices)
        .where(
          and(eq(devices.tenantId, context.tenantId), eq(devices.id, deviceId))
        )
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new DeviceError(
          "DEVICE_IN_USE",
          "This device still has related records and cannot be deleted.",
          409
        )
      }
      throw error
    }

    return { id: device.id, hardwareUid: device.hardwareUid }
  })
}

function isForeignKeyViolation(error: unknown): boolean {
  let current = error
  for (let depth = 0; depth < 6; depth += 1) {
    if (!current || typeof current !== "object") {
      return false
    }

    const record = current as { code?: unknown; cause?: unknown }
    if (record.code === "23503") {
      return true
    }

    current = record.cause
  }

  return false
}

async function assertAssignmentVenue(
  context: TenantContext,
  deviceId: string,
  locationId: string,
  resourceId: string | null,
  role: DeviceAssignmentRole
) {
  const [device] = await db
    .select()
    .from(devices)
    .where(
      and(eq(devices.tenantId, context.tenantId), eq(devices.id, deviceId))
    )
    .limit(1)

  if (!device) {
    throw new DeviceError("DEVICE_NOT_FOUND", "Device not found.", 404)
  }

  if (device.status === "revoked") {
    throw new DeviceError("DEVICE_REVOKED", "Device has been revoked.", 403)
  }

  if (device.locationId !== locationId) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Device and assignment venue must match.",
      400
    )
  }

  let resourceCapabilityCodes: string[] = []

  if (resourceId) {
    const [resource] = await db
      .select({ locationId: resources.locationId })
      .from(resources)
      .where(
        and(
          eq(resources.tenantId, context.tenantId),
          eq(resources.id, resourceId)
        )
      )
      .limit(1)

    if (!resource || resource.locationId !== locationId) {
      throw new DeviceError(
        "VALIDATION_ERROR",
        "Resource must belong to the assignment venue.",
        400
      )
    }

    resourceCapabilityCodes = (
      await db
        .select({ code: resourceCapabilities.code })
        .from(resourceCapabilities)
        .where(
          and(
            eq(resourceCapabilities.tenantId, context.tenantId),
            eq(resourceCapabilities.resourceId, resourceId)
          )
        )
    ).map((capability) => capability.code)
  }

  const policy = validateDeviceAssignmentPolicy({
    role,
    deviceType: device.type,
    deviceCapabilityCodes: device.capabilityCodes ?? [],
    resourceId,
    resourceCapabilityCodes,
  })

  if (!policy.ok) {
    throw new DeviceError(
      "DEVICE_ROLE_UNSUPPORTED",
      `Device assignment is incompatible with role or capabilities (${policy.reason}).`,
      400
    )
  }
}

async function assertNoOverlappingAssignment(
  context: TenantContext,
  input: {
    deviceId: string
    resourceId: string | null
    role: DeviceAssignmentRole
    effectiveFrom: Date
    effectiveTo: Date | null
  }
) {
  const overlapWindow = and(
    eq(deviceAssignments.tenantId, context.tenantId),
    or(
      isNull(deviceAssignments.effectiveTo),
      gt(deviceAssignments.effectiveTo, input.effectiveFrom)
    ),
    input.effectiveTo
      ? lt(deviceAssignments.effectiveFrom, input.effectiveTo)
      : undefined
  )

  const deviceOverlap = and(
    overlapWindow,
    eq(deviceAssignments.deviceId, input.deviceId)
  )

  const scoringOverlap =
    input.role === "score_input" && input.resourceId
      ? and(
          overlapWindow,
          eq(deviceAssignments.resourceId, input.resourceId),
          eq(deviceAssignments.role, "score_input")
        )
      : undefined

  const whereClause = scoringOverlap
    ? or(deviceOverlap, scoringOverlap)
    : deviceOverlap

  const overlapping = await db
    .select({ id: deviceAssignments.id })
    .from(deviceAssignments)
    .where(whereClause)
    .limit(1)

  if (overlapping.length > 0) {
    throw new DeviceError(
      "ASSIGNMENT_CONFLICT",
      "An overlapping active assignment already exists.",
      409
    )
  }
}

export async function assignDevice(
  context: TenantContext,
  input: {
    deviceId: string
    locationId: string
    resourceId?: string | null
    role: DeviceAssignmentRole
    effectiveFrom?: string
    effectiveTo?: string | null
    config?: Record<string, unknown>
    configVersion?: number
  }
): Promise<DeviceAssignmentRecord> {
  await assertAssignmentVenue(
    context,
    input.deviceId,
    input.locationId,
    input.resourceId ?? null,
    input.role
  )

  const effectiveFrom = input.effectiveFrom
    ? new Date(input.effectiveFrom)
    : new Date()
  const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null

  if (effectiveTo && effectiveTo <= effectiveFrom) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Assignment end must be after start.",
      400
    )
  }

  await assertNoOverlappingAssignment(context, {
    deviceId: input.deviceId,
    resourceId: input.resourceId ?? null,
    role: input.role,
    effectiveFrom,
    effectiveTo,
  })

  const [created] = await db
    .insert(deviceAssignments)
    .values({
      tenantId: context.tenantId,
      deviceId: input.deviceId,
      locationId: input.locationId,
      resourceId: input.resourceId ?? null,
      role: input.role,
      effectiveFrom,
      effectiveTo,
      config: input.config ?? {},
      configVersion: input.configVersion ?? 1,
    })
    .returning()

  return mapAssignment(created)
}

export async function endDeviceAssignment(
  context: TenantContext,
  assignmentId: string,
  effectiveTo?: string
): Promise<DeviceAssignmentRecord> {
  const endAt = effectiveTo ? new Date(effectiveTo) : new Date()

  const [updated] = await db
    .update(deviceAssignments)
    .set({
      effectiveTo: endAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(deviceAssignments.tenantId, context.tenantId),
        eq(deviceAssignments.id, assignmentId),
        isNull(deviceAssignments.effectiveTo)
      )
    )
    .returning()

  if (!updated) {
    throw new DeviceError(
      "ASSIGNMENT_NOT_FOUND",
      "Open assignment not found.",
      404
    )
  }

  return mapAssignment(updated)
}

export async function getCurrentAssignmentForDevice(
  tenantId: string,
  deviceId: string,
  at: Date = new Date()
): Promise<DeviceAssignmentRecord | null> {
  const [assignment] = await db
    .select()
    .from(deviceAssignments)
    .where(
      and(
        eq(deviceAssignments.tenantId, tenantId),
        eq(deviceAssignments.deviceId, deviceId),
        lte(deviceAssignments.effectiveFrom, at),
        or(
          isNull(deviceAssignments.effectiveTo),
          gt(deviceAssignments.effectiveTo, at)
        )
      )
    )
    .orderBy(desc(deviceAssignments.effectiveFrom))
    .limit(1)

  return assignment ? mapAssignment(assignment) : null
}

export async function getDeviceConfigForAuthenticatedDevice(input: {
  tenantId: string
  deviceId: string
  deviceStatus: DeviceStatus
}): Promise<{
  configVersion: number
  assignment: DeviceAssignmentRecord
  resourceId: string | null
  role: DeviceAssignmentRole
  config: Record<string, unknown>
}> {
  if (input.deviceStatus === "revoked") {
    throw new DeviceError("DEVICE_REVOKED", "Device has been revoked.", 403)
  }

  const now = new Date()
  const assignment = await getCurrentAssignmentForDevice(
    input.tenantId,
    input.deviceId,
    now
  )

  if (!assignment) {
    throw new DeviceError(
      "DEVICE_FORBIDDEN",
      "Device has no current assignment.",
      403
    )
  }

  if (assignment.effectiveTo && new Date(assignment.effectiveTo) <= now) {
    throw new DeviceError(
      "ASSIGNMENT_STALE",
      "Device assignment is no longer active.",
      403
    )
  }

  return {
    configVersion: assignment.configVersion,
    assignment,
    resourceId: assignment.resourceId,
    role: assignment.role,
    config: assignment.config,
  }
}

export async function findEnrollmentByCodeHash(codeHash: string) {
  const [row] = await db
    .select()
    .from(deviceEnrollments)
    .where(eq(deviceEnrollments.codeHash, codeHash))
    .limit(1)

  return row ?? null
}

export function isEnrollmentCodeValid(
  enrollment: typeof deviceEnrollments.$inferSelect,
  enrollmentCode: string
) {
  return (
    !enrollment.consumedAt &&
    enrollment.expiresAt > new Date() &&
    verifyEnrollmentCode(enrollmentCode, enrollment.codeHash)
  )
}
