import { and, desc, eq, inArray } from "drizzle-orm"

import db from "@/db/drizzle"
import { deviceHeartbeats, devices } from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import {
  deriveDeviceHealth,
  getHeartbeatSampleIntervalSeconds,
  type DeviceHealthStatus,
} from "@/server/devices/health-policy"
import { updateAppliedConfigVersion } from "@/server/devices/commands"

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
  row: typeof deviceHeartbeats.$inferSelect,
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
  input: DeviceHeartbeatInput,
): Promise<DeviceHeartbeatResult> {
  const observedAt = input.observedAt
    ? new Date(input.observedAt)
    : new Date()

  if (Number.isNaN(observedAt.getTime())) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Heartbeat observedAt must be a valid timestamp.",
      400,
    )
  }

  const [device] = await db
    .select()
    .from(devices)
    .where(
      and(eq(devices.tenantId, input.tenantId), eq(devices.id, input.deviceId)),
    )
    .limit(1)

  if (!device) {
    throw new DeviceError("DEVICE_NOT_FOUND", "Device not found.", 404)
  }

  if (device.status === "revoked") {
    throw new DeviceError("DEVICE_REVOKED", "Device has been revoked.", 403)
  }

  const sampleIntervalMs = getHeartbeatSampleIntervalSeconds() * 1000
  const [latestSample] = await db
    .select({ observedAt: deviceHeartbeats.observedAt })
    .from(deviceHeartbeats)
    .where(
      and(
        eq(deviceHeartbeats.tenantId, input.tenantId),
        eq(deviceHeartbeats.deviceId, input.deviceId),
      ),
    )
    .orderBy(desc(deviceHeartbeats.observedAt))
    .limit(1)

  const shouldSample =
    !latestSample ||
    observedAt.getTime() - latestSample.observedAt.getTime() >= sampleIntervalMs

  await db.transaction(async (tx) => {
    await tx
      .update(devices)
      .set({
        lastSeenAt: observedAt,
        lastHeartbeatAt: observedAt,
        firmwareVersion: input.firmwareVersion ?? device.firmwareVersion,
        updatedAt: new Date(),
      })
      .where(
        and(eq(devices.tenantId, input.tenantId), eq(devices.id, input.deviceId)),
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
  })

  if (
    typeof input.appliedConfigVersion === "number" &&
    Number.isFinite(input.appliedConfigVersion)
  ) {
    await updateAppliedConfigVersion(
      input.tenantId,
      input.deviceId,
      input.appliedConfigVersion,
    )
  }

  return {
    health: deriveDeviceHealth(observedAt),
    lastHeartbeatAt: observedAt.toISOString(),
    sampled: shouldSample,
  }
}

export async function listRecentDeviceHeartbeats(
  tenantId: string,
  deviceId: string,
  limit = 20,
): Promise<DeviceHeartbeatRecord[]> {
  const rows = await db
    .select()
    .from(deviceHeartbeats)
    .where(
      and(
        eq(deviceHeartbeats.tenantId, tenantId),
        eq(deviceHeartbeats.deviceId, deviceId),
      ),
    )
    .orderBy(desc(deviceHeartbeats.observedAt))
    .limit(limit)

  return rows.map(mapHeartbeat)
}

export async function pruneDeviceHeartbeatHistory(
  tenantId: string,
  deviceId: string,
  retainCount = 100,
) {
  const rows = await db
    .select({ id: deviceHeartbeats.id })
    .from(deviceHeartbeats)
    .where(
      and(
        eq(deviceHeartbeats.tenantId, tenantId),
        eq(deviceHeartbeats.deviceId, deviceId),
      ),
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
        inArray(deviceHeartbeats.id, ids),
      ),
    )
    .returning({ id: deviceHeartbeats.id })

  return deleted.length
}
