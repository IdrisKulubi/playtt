import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  deviceAssignments,
  deviceCommandAcks,
  deviceCommands,
  devices,
} from "@/db/schema"
import type {
  deviceCommandKindEnum,
  deviceCommandStatusEnum,
} from "@/db/schema"
import type {
  AcknowledgeDeviceCommandInput,
  DeviceCommandBus,
  EnqueueDeviceCommandInput,
} from "@/server/devices/command-bus"
import { DeviceError } from "@/server/devices/errors"
import {
  DEFAULT_COMMAND_RETRY_INTERVAL_SECONDS,
  DEFAULT_COMMAND_TTL_SECONDS,
} from "@/server/devices/health-policy"

export type DeviceCommandKind =
  (typeof deviceCommandKindEnum.enumValues)[number]
export type DeviceCommandStatus =
  (typeof deviceCommandStatusEnum.enumValues)[number]

export interface DeviceCommandRecord {
  id: string
  tenantId: string
  deviceId: string
  kind: DeviceCommandKind
  payload: Record<string, unknown>
  status: DeviceCommandStatus
  expiresAt: string
  correlationId: string
  causationId: string | null
  attemptCount: number
  maxAttempts: number
  deliveredAt: string | null
  acknowledgedAt: string | null
  failedAt: string | null
  expiredAt: string | null
  result: Record<string, unknown> | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

function mapCommand(
  row: typeof deviceCommands.$inferSelect
): DeviceCommandRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    deviceId: row.deviceId,
    kind: row.kind,
    payload: row.payload ?? {},
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    correlationId: row.correlationId,
    causationId: row.causationId,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    expiredAt: row.expiredAt?.toISOString() ?? null,
    result: row.result ?? null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function assertActiveDevice(tenantId: string, deviceId: string) {
  const [device] = await db
    .select({ status: devices.status })
    .from(devices)
    .where(and(eq(devices.tenantId, tenantId), eq(devices.id, deviceId)))
    .limit(1)

  if (!device) {
    throw new DeviceError("DEVICE_NOT_FOUND", "Device not found.", 404)
  }

  if (device.status === "revoked") {
    throw new DeviceError("DEVICE_REVOKED", "Device has been revoked.", 403)
  }
}

export async function expireStaleDeviceCommands(now: Date = new Date()) {
  const expired = await db
    .update(deviceCommands)
    .set({
      status: "expired",
      expiredAt: now,
      updatedAt: now,
    })
    .where(
      and(
        inArray(deviceCommands.status, ["pending", "delivered"]),
        lte(deviceCommands.expiresAt, now)
      )
    )
    .returning({ id: deviceCommands.id })

  return expired.length
}

export async function failExhaustedDeviceCommands(
  now: Date = new Date(),
  tenantId?: string,
  deviceId?: string
) {
  const retryBefore = new Date(
    now.getTime() - DEFAULT_COMMAND_RETRY_INTERVAL_SECONDS * 1000
  )
  const failed = await db
    .update(deviceCommands)
    .set({
      status: "failed",
      failedAt: now,
      lastError: "Device command acknowledgement timed out.",
      updatedAt: now,
    })
    .where(
      and(
        tenantId ? eq(deviceCommands.tenantId, tenantId) : undefined,
        deviceId ? eq(deviceCommands.deviceId, deviceId) : undefined,
        eq(deviceCommands.status, "delivered"),
        sql`${deviceCommands.attemptCount} >= ${deviceCommands.maxAttempts}`,
        lte(deviceCommands.deliveredAt, retryBefore)
      )
    )
    .returning({ id: deviceCommands.id })

  return failed.length
}

export async function enqueueDeviceCommand(
  input: EnqueueDeviceCommandInput
): Promise<DeviceCommandRecord> {
  await assertActiveDevice(input.tenantId, input.deviceId)

  const expiresInSeconds = input.expiresInSeconds ?? DEFAULT_COMMAND_TTL_SECONDS
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Device command expiry must be positive.",
      400
    )
  }
  const maxAttempts = input.maxAttempts ?? 3
  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Device command max attempts must be a positive integer.",
      400
    )
  }
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000)

  const [created] = await db
    .insert(deviceCommands)
    .values({
      tenantId: input.tenantId,
      deviceId: input.deviceId,
      kind: input.kind,
      payload: input.payload ?? {},
      expiresAt,
      correlationId: input.correlationId,
      causationId: input.causationId ?? null,
      maxAttempts,
    })
    .returning()

  return mapCommand(created)
}

export async function listPendingDeviceCommands(
  tenantId: string,
  deviceId: string
): Promise<DeviceCommandRecord[]> {
  const now = new Date()
  await expireStaleDeviceCommands(now)
  const retryBefore = new Date(
    now.getTime() - DEFAULT_COMMAND_RETRY_INTERVAL_SECONDS * 1000
  )
  await failExhaustedDeviceCommands(now, tenantId, deviceId)

  const rows = await db
    .select()
    .from(deviceCommands)
    .where(
      and(
        eq(deviceCommands.tenantId, tenantId),
        eq(deviceCommands.deviceId, deviceId),
        or(
          eq(deviceCommands.status, "pending"),
          and(
            eq(deviceCommands.status, "delivered"),
            sql`${deviceCommands.attemptCount} < ${deviceCommands.maxAttempts}`,
            lte(deviceCommands.deliveredAt, retryBefore)
          )
        ),
        gt(deviceCommands.expiresAt, now)
      )
    )
    .orderBy(deviceCommands.createdAt)

  return rows.map(mapCommand)
}

export async function markDeviceCommandDelivered(
  tenantId: string,
  deviceId: string,
  commandId: string
): Promise<DeviceCommandRecord | null> {
  const now = new Date()

  const [updated] = await db
    .update(deviceCommands)
    .set({
      status: "delivered",
      deliveredAt: now,
      attemptCount: sql`${deviceCommands.attemptCount} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(deviceCommands.tenantId, tenantId),
        eq(deviceCommands.deviceId, deviceId),
        eq(deviceCommands.id, commandId),
        inArray(deviceCommands.status, ["pending", "delivered"]),
        sql`${deviceCommands.attemptCount} < ${deviceCommands.maxAttempts}`,
        gt(deviceCommands.expiresAt, now)
      )
    )
    .returning()

  if (updated) {
    return mapCommand(updated)
  }

  const [existing] = await db
    .select()
    .from(deviceCommands)
    .where(
      and(
        eq(deviceCommands.tenantId, tenantId),
        eq(deviceCommands.deviceId, deviceId),
        eq(deviceCommands.id, commandId)
      )
    )
    .limit(1)

  return existing ? mapCommand(existing) : null
}

export async function acknowledgeDeviceCommand(
  input: AcknowledgeDeviceCommandInput
): Promise<DeviceCommandRecord> {
  const now = new Date()

  return db.transaction(async (tx) => {
    const [command] = await tx
      .select()
      .from(deviceCommands)
      .where(
        and(
          eq(deviceCommands.tenantId, input.tenantId),
          eq(deviceCommands.deviceId, input.deviceId),
          eq(deviceCommands.id, input.commandId)
        )
      )
      .limit(1)
      .for("update")

    if (!command) {
      throw new DeviceError(
        "COMMAND_NOT_FOUND",
        "Device command not found.",
        404
      )
    }

    if (command.status === "expired" || command.expiredAt) {
      throw new DeviceError(
        "COMMAND_EXPIRED",
        "Device command has expired.",
        409
      )
    }

    if (command.expiresAt <= now && command.status !== "acknowledged") {
      await tx
        .update(deviceCommands)
        .set({
          status: "expired",
          expiredAt: now,
          updatedAt: now,
        })
        .where(eq(deviceCommands.id, command.id))

      throw new DeviceError(
        "COMMAND_EXPIRED",
        "Device command has expired.",
        409
      )
    }

    const [existingAck] = await tx
      .select()
      .from(deviceCommandAcks)
      .where(
        and(
          eq(deviceCommandAcks.commandId, input.commandId),
          eq(deviceCommandAcks.idempotencyKey, input.idempotencyKey)
        )
      )
      .limit(1)

    if (existingAck) {
      const [current] = await tx
        .select()
        .from(deviceCommands)
        .where(eq(deviceCommands.id, input.commandId))
        .limit(1)

      if (!current) {
        throw new DeviceError(
          "COMMAND_NOT_FOUND",
          "Device command not found.",
          404
        )
      }

      return mapCommand(current)
    }

    if (
      command.status === "acknowledged" ||
      command.status === "failed" ||
      command.status === "cancelled"
    ) {
      return mapCommand(command)
    }

    await tx.insert(deviceCommandAcks).values({
      tenantId: input.tenantId,
      commandId: input.commandId,
      deviceId: input.deviceId,
      idempotencyKey: input.idempotencyKey,
      success: input.success,
      result: input.result ?? null,
      receivedAt: now,
    })

    const nextStatus = input.success ? "acknowledged" : "failed"

    const [updated] = await tx
      .update(deviceCommands)
      .set({
        status: nextStatus,
        acknowledgedAt: input.success ? now : command.acknowledgedAt,
        failedAt: input.success ? command.failedAt : now,
        result: input.result ?? null,
        lastError: input.success ? null : "Device reported command failure.",
        updatedAt: now,
      })
      .where(
        and(
          eq(deviceCommands.id, input.commandId),
          inArray(deviceCommands.status, ["pending", "delivered"])
        )
      )
      .returning()

    if (!updated) {
      const [current] = await tx
        .select()
        .from(deviceCommands)
        .where(eq(deviceCommands.id, input.commandId))
        .limit(1)

      if (!current) {
        throw new DeviceError(
          "COMMAND_NOT_FOUND",
          "Device command not found.",
          404
        )
      }

      return mapCommand(current)
    }

    return mapCommand(updated)
  })
}

export const postgresDeviceCommandBus: DeviceCommandBus = {
  enqueue: enqueueDeviceCommand,
  listPendingForDevice: listPendingDeviceCommands,
  markDelivered: markDeviceCommandDelivered,
  acknowledge: acknowledgeDeviceCommand,
  expireStaleCommands: expireStaleDeviceCommands,
}

export async function updateAppliedConfigVersion(
  tenantId: string,
  deviceId: string,
  appliedConfigVersion: number
) {
  const now = new Date()

  await db
    .update(deviceAssignments)
    .set({
      appliedConfigVersion,
      updatedAt: now,
    })
    .where(
      and(
        eq(deviceAssignments.tenantId, tenantId),
        eq(deviceAssignments.deviceId, deviceId),
        lte(deviceAssignments.effectiveFrom, now),
        or(
          isNull(deviceAssignments.effectiveTo),
          gt(deviceAssignments.effectiveTo, now)
        )
      )
    )
}
