import {
  assignDevice,
  createEnrollment,
  endDeviceAssignment,
  issueProvisionedDevice,
  listDevices,
  revokeDevice,
  deleteDevice,
  rotateDeviceCredential,
  type DeviceAssignmentRole,
  type DeviceListItem,
  type DeviceType,
} from "@/server/devices/devices"
import {
  enqueueDeviceCommand,
  type DeviceCommandKind,
} from "@/server/devices/commands"
import { getLatestDeviceHeartbeat } from "@/server/devices/heartbeats"
import { deriveDeviceHealth } from "@/server/devices/health-policy"
import db from "@/db/drizzle"
import { devices } from "@/db/schema"
import { and, eq, ne } from "drizzle-orm"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export async function listDevicesForOperator(
  context: TenantContext,
  locationId?: string,
): Promise<DeviceListItem[]> {
  authorize(context, "venue.read")
  return listDevices(context, locationId)
}

export async function createEnrollmentForOperator(
  context: TenantContext,
  input: {
    locationId: string
    deviceType: DeviceType
    expiresInMinutes?: number
  },
): Promise<{ enrollmentId: string; enrollmentCode: string; expiresAt: string }> {
  authorize(context, "venue.manage")
  const enrollment = await createEnrollment(context, input)

  await writeAuditLog(context, {
    action: "device.enrollment.create",
    targetType: "device_enrollment",
    targetId: enrollment.enrollmentId,
    metadata: {
      locationId: input.locationId,
      deviceType: input.deviceType,
      expiresAt: enrollment.expiresAt,
    },
  })

  return enrollment
}

export async function issueProvisionedDeviceForOperator(
  context: TenantContext,
  input: {
    locationId: string
    deviceType: DeviceType
    hardwareUid?: string
    expiresInMinutes?: number
  },
) {
  authorize(context, "venue.manage")
  const issued = await issueProvisionedDevice(context, input)

  await writeAuditLog(context, {
    action: "device.credentials.issue",
    targetType: "device",
    targetId: issued.deviceId,
    metadata: {
      locationId: input.locationId,
      deviceType: input.deviceType,
      hardwareUid: issued.hardwareUid,
    },
  })

  return issued
}

export async function assignDeviceForOperator(
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
  },
) {
  authorize(context, "venue.manage")
  const assignment = await assignDevice(context, input)

  await writeAuditLog(context, {
    action: "device.assignment.create",
    targetType: "device_assignment",
    targetId: assignment.id,
    metadata: {
      deviceId: assignment.deviceId,
      resourceId: assignment.resourceId,
      role: assignment.role,
    },
  })

  return assignment
}

export async function endDeviceAssignmentForOperator(
  context: TenantContext,
  assignmentId: string,
  effectiveTo?: string,
) {
  authorize(context, "venue.manage")
  const assignment = await endDeviceAssignment(context, assignmentId, effectiveTo)

  await writeAuditLog(context, {
    action: "device.assignment.end",
    targetType: "device_assignment",
    targetId: assignment.id,
    metadata: {
      deviceId: assignment.deviceId,
      effectiveTo: assignment.effectiveTo,
    },
  })

  return assignment
}

export async function revokeDeviceForOperator(
  context: TenantContext,
  deviceId: string,
) {
  authorize(context, "venue.manage")
  const device = await revokeDevice(context, deviceId)

  await writeAuditLog(context, {
    action: "device.revoke",
    targetType: "device",
    targetId: device.id,
    metadata: {
      hardwareUid: device.hardwareUid,
    },
  })

  return device
}

export async function deleteDeviceForOperator(
  context: TenantContext,
  deviceId: string,
) {
  authorize(context, "venue.manage")
  const deleted = await deleteDevice(context, deviceId)

  await writeAuditLog(context, {
    action: "device.delete",
    targetType: "device",
    targetId: deleted.id,
    metadata: {
      hardwareUid: deleted.hardwareUid,
    },
  })

  return deleted
}

export async function rotateDeviceCredentialForOperator(
  context: TenantContext,
  deviceId: string,
) {
  authorize(context, "venue.manage")
  const rotated = await rotateDeviceCredential({
    deviceId,
    tenantId: context.tenantId,
  })

  await writeAuditLog(context, {
    action: "device.credential.rotate",
    targetType: "device",
    targetId: deviceId,
    metadata: {
      credentialVersion: rotated.credentialVersion,
    },
  })

  return rotated
}

export async function enqueueDeviceCommandForOperator(
  context: TenantContext,
  input: {
    deviceId: string
    kind: DeviceCommandKind
    payload?: Record<string, unknown>
    expiresInSeconds?: number
  },
) {
  authorize(context, "venue.manage")

  const command = await enqueueDeviceCommand({
    tenantId: context.tenantId,
    deviceId: input.deviceId,
    kind: input.kind,
    payload: input.payload,
    expiresInSeconds: input.expiresInSeconds,
    correlationId: context.correlationId,
  })

  await writeAuditLog(context, {
    action: "device.command.enqueue",
    targetType: "device_command",
    targetId: command.id,
    metadata: {
      deviceId: command.deviceId,
      kind: command.kind,
      expiresAt: command.expiresAt,
    },
  })

  return command
}

export async function getVenueEdgeCapacityForLocation(
  context: TenantContext,
  locationId: string,
) {
  authorize(context, "venue.read")

  const [device] = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.tenantId, context.tenantId),
        eq(devices.locationId, locationId),
        eq(devices.type, "venue_edge"),
        ne(devices.status, "revoked"),
      ),
    )
    .limit(1)

  if (!device) {
    return null
  }

  const heartbeat = await getLatestDeviceHeartbeat(context.tenantId, device.id)
  const metrics = heartbeat?.metrics ?? {}

  return {
    deviceId: device.id,
    lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() ?? null,
    health: deriveDeviceHealth(device.lastHeartbeatAt),
    metrics: {
      activeReplayJobs: Number(metrics.activeReplayJobs ?? 0),
      replayQueueDepth: Number(metrics.uploadQueueDepth ?? 0),
      maxConcurrentReplays: Number(metrics.maxConcurrentReplays ?? 0),
      ffmpegRunning: Boolean(metrics.ffmpegRunning),
    },
  }
}
