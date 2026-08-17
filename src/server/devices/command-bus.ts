import type {
  DeviceCommandKind,
  DeviceCommandRecord,
} from "@/server/devices/commands"

export interface EnqueueDeviceCommandInput {
  tenantId: string
  deviceId: string
  kind: DeviceCommandKind
  payload?: Record<string, unknown>
  expiresInSeconds?: number
  correlationId: string
  causationId?: string | null
  maxAttempts?: number
}

export interface AcknowledgeDeviceCommandInput {
  tenantId: string
  deviceId: string
  commandId: string
  idempotencyKey: string
  success: boolean
  result?: Record<string, unknown>
}

export interface DeviceCommandBus {
  enqueue(input: EnqueueDeviceCommandInput): Promise<DeviceCommandRecord>
  listPendingForDevice(
    tenantId: string,
    deviceId: string,
  ): Promise<DeviceCommandRecord[]>
  markDelivered(
    tenantId: string,
    deviceId: string,
    commandId: string,
  ): Promise<DeviceCommandRecord | null>
  acknowledge(input: AcknowledgeDeviceCommandInput): Promise<DeviceCommandRecord>
  expireStaleCommands(now?: Date): Promise<number>
}
