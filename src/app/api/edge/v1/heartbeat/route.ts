import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { requireDeviceRequest } from "@/server/devices/auth"
import { postgresDeviceCommandBus } from "@/server/devices/commands"
import { mapDeviceError } from "@/server/devices/http"
import { recordDeviceHeartbeat } from "@/server/devices/heartbeats"

const heartbeatSchema = z.object({
  bootId: z.string().trim().min(1),
  observedAt: z.string().datetime().optional(),
  firmwareVersion: z.string().trim().optional(),
  uptimeMs: z.number().int().nonnegative().optional(),
  wifiRssi: z.number().int().optional(),
  freeHeapBytes: z.number().int().nonnegative().optional(),
  metrics: z.record(z.unknown()).optional(),
  appliedConfigVersion: z.number().int().positive().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDeviceRequest(req)
    const body = heartbeatSchema.parse(await req.json())

    const heartbeat = await recordDeviceHeartbeat({
      tenantId: auth.device.tenantId,
      deviceId: auth.device.id,
      bootId: body.bootId,
      observedAt: body.observedAt,
      firmwareVersion: body.firmwareVersion,
      uptimeMs: body.uptimeMs,
      wifiRssi: body.wifiRssi,
      freeHeapBytes: body.freeHeapBytes,
      metrics: body.metrics,
      appliedConfigVersion: body.appliedConfigVersion,
      correlationId: auth.context.correlationId,
    })

    const pendingCommands = await postgresDeviceCommandBus.listPendingForDevice(
      auth.device.tenantId,
      auth.device.id,
    )

    return Response.json({
      data: {
        health: heartbeat.health,
        lastHeartbeatAt: heartbeat.lastHeartbeatAt,
        sampled: heartbeat.sampled,
        pendingCommandCount: pendingCommands.length,
      },
    })
  } catch (error) {
    return mapDeviceError(error)
  }
}
