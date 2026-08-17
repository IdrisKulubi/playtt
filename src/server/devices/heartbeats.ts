import { and, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm"

import db from "@/db/drizzle"
import { deviceAssignments, deviceHeartbeats, devices } from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import {
  deriveDeviceHealth,
  getHeartbeatSampleIntervalSeconds,
  getHeartbeatRetentionCount,
  type DeviceHealthStatus,
} from "@/server/devices/health-policy"
import {
  evaluateConfigAcknowledgement,
  nextHeartbeatTimestamp,
  validateHeartbeatObservedAt,
} from "@/server/devices/policies.mjs"

export interface DeviceHeartbeatInput {
  tenantId: string
  deviceId: string
  bootId: string
  observedAt?: string
  firmwareVersion?: string | null
  uptimeMs?: number | null
  wifiRssi?: number | null
  freeHeapBytes?: number | null
  metrics?: Record<string, unknown>
  appliedConfigVersion?: number | null
  correlationId: string
}

export interface DeviceHeartbeatRecord {
  id: string
  tenantId: string
  deviceId: string
  bootId: string
  observedAt: string
  firmwareVersion: string | null
  uptimeMs: number | null
  wifiRssi: number | null
  freeHeapBytes: number | null
  metrics: Record<string, unknown>
  correlationId: string
  createdAt: string
}

export interface DeviceHeartbeatResult {
  health: DeviceHealthStatus
  lastHeartbeatAt: string
  sampled: boolean
}

function mapHeartbeat(
  row: typeof deviceHeartbeats.$inferSelect
): DeviceHeartbeatRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    deviceId: row.deviceId,
    bootId: row.bootId,
    observedAt: row.observedAt.toISOString(),
    firmwareVersion: row.firmwareVersion,
    uptimeMs: row.uptimeMs,
    wifiRssi: row.wifiRssi,
    freeHeapBytes: row.freeHeapBytes,
    metrics: row.metrics ?? {},
    correlationId: row.correlationId,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function recordDeviceHeartbeat(
  input: DeviceHeartbeatInput
): Promise<DeviceHeartbeatResult> {
  const now = new Date()
  const timestamp = validateHeartbeatObservedAt(input.observedAt, now)
  if (!timestamp.ok || !timestamp.observedAt) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      timestamp.reason === "future_timestamp"
        ? "Heartbeat observedAt is too far in the future."
        : "Heartbeat observedAt must be a valid timestamp.",
      400
    )
  }
  const observedAt = timestamp.observedAt

  return db.transaction(async (tx) => {
    const [device] = await tx
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.tenantId, input.tenantId),
          eq(devices.id, input.deviceId)
        )
      )
      .limit(1)
      .for("update")

    if (!device) {
      throw new DeviceError("DEVICE_NOT_FOUND", "Device not found.", 404)
    }

    if (device.status === "revoked") {
      throw new DeviceError("DEVICE_REVOKED", "Device has been revoked.", 403)
    }

    const [latestSample] = await tx
      .select({ observedAt: deviceHeartbeats.observedAt })
      .from(deviceHeartbeats)
      .where(
        and(
          eq(deviceHeartbeats.tenantId, input.tenantId),
          eq(deviceHeartbeats.deviceId, input.deviceId)
        )
      )
      .orderBy(desc(deviceHeartbeats.observedAt))
      .limit(1)

    const sampleIntervalMs = getHeartbeatSampleIntervalSeconds() * 1000
    const shouldSample =
      !latestSample ||
      observedAt.getTime() - latestSample.observedAt.getTime() >=
        sampleIntervalMs
    const authoritativeHeartbeatAt = nextHeartbeatTimestamp(
      device.lastHeartbeatAt,
      observedAt
    )

    let configAck: { assignmentId: string; kind: string } | null = null
    if (typeof input.appliedConfigVersion === "number") {
      const [assignment] = await tx
        .select({
          id: deviceAssignments.id,
          configVersion: deviceAssignments.configVersion,
          appliedConfigVersion: deviceAssignments.appliedConfigVersion,
        })
        .from(deviceAssignments)
        .where(
          and(
            eq(deviceAssignments.tenantId, input.tenantId),
            eq(deviceAssignments.deviceId, input.deviceId),
            lte(deviceAssignments.effectiveFrom, now),
            or(
              isNull(deviceAssignments.effectiveTo),
              gt(deviceAssignments.effectiveTo, now)
            )
          )
        )
        .orderBy(desc(deviceAssignments.effectiveFrom))
        .limit(1)

      if (!assignment) {
        throw new DeviceError(
          "ASSIGNMENT_STALE",
          "Device has no current assignment for this configuration acknowledgement.",
          409
        )
      }

      const decision = evaluateConfigAcknowledgement({
        received: input.appliedConfigVersion,
        configVersion: assignment.configVersion,
        appliedConfigVersion: assignment.appliedConfigVersion,
      })
      if (decision.kind === "invalid" || decision.kind === "ahead") {
        throw new DeviceError(
          "CONFIG_VERSION_INVALID",
          "Applied configuration version is invalid for the current assignment.",
          409
        )
      }
      configAck = { assignmentId: assignment.id, kind: decision.kind }
    }

    await tx
      .update(devices)
      .set({
        lastSeenAt: authoritativeHeartbeatAt,
        lastHeartbeatAt: authoritativeHeartbeatAt,
        firmwareVersion: input.firmwareVersion ?? device.firmwareVersion,
        updatedAt: now,
      })
      .where(
        and(
          eq(devices.tenantId, input.tenantId),
          eq(devices.id, input.deviceId)
        )
      )

    if (shouldSample) {
      await tx.insert(deviceHeartbeats).values({
        tenantId: input.tenantId,
        deviceId: input.deviceId,
        bootId: input.bootId,
        observedAt,
        firmwareVersion: input.firmwareVersion ?? device.firmwareVersion,
        uptimeMs: input.uptimeMs ?? null,
        wifiRssi: input.wifiRssi ?? null,
        freeHeapBytes: input.freeHeapBytes ?? null,
        metrics: input.metrics ?? {},
        correlationId: input.correlationId,
      })
    }

    if (configAck?.kind === "apply") {
      await tx
        .update(deviceAssignments)
        .set({
          appliedConfigVersion: input.appliedConfigVersion,
          updatedAt: now,
        })
        .where(
          and(
            eq(deviceAssignments.tenantId, input.tenantId),
            eq(deviceAssignments.id, configAck.assignmentId)
          )
        )
    }

    return {
      health: deriveDeviceHealth(authoritativeHeartbeatAt, now),
      lastHeartbeatAt: authoritativeHeartbeatAt.toISOString(),
      sampled: shouldSample,
    }
  })
}

export async function listRecentDeviceHeartbeats(
  tenantId: string,
  deviceId: string,
  limit = 20
): Promise<DeviceHeartbeatRecord[]> {
  const rows = await db
    .select()
    .from(deviceHeartbeats)
    .where(
      and(
        eq(deviceHeartbeats.tenantId, tenantId),
        eq(deviceHeartbeats.deviceId, deviceId)
      )
    )
    .orderBy(desc(deviceHeartbeats.observedAt))
    .limit(limit)

  return rows.map(mapHeartbeat)
}

export async function pruneDeviceHeartbeatHistory(
  tenantId: string,
  deviceId: string,
  retainCount = 100
) {
  const rows = await db
    .select({ id: deviceHeartbeats.id })
    .from(deviceHeartbeats)
    .where(
      and(
        eq(deviceHeartbeats.tenantId, tenantId),
        eq(deviceHeartbeats.deviceId, deviceId)
      )
    )
    .orderBy(desc(deviceHeartbeats.observedAt))
    .offset(retainCount)

  if (rows.length === 0) {
    return 0
  }

  const ids = rows.map((row) => row.id)
  const deleted = await db
    .delete(deviceHeartbeats)
    .where(
      and(
        eq(deviceHeartbeats.tenantId, tenantId),
        eq(deviceHeartbeats.deviceId, deviceId),
        inArray(deviceHeartbeats.id, ids)
      )
    )
    .returning({ id: deviceHeartbeats.id })

  return deleted.length
}

export async function pruneAllDeviceHeartbeatHistory(
  retainCount = getHeartbeatRetentionCount()
) {
  const rows = await db
    .select({ tenantId: devices.tenantId, id: devices.id })
    .from(devices)
  let deleted = 0

  for (const device of rows) {
    deleted += await pruneDeviceHeartbeatHistory(
      device.tenantId,
      device.id,
      retainCount
    )
  }

  return deleted
}
