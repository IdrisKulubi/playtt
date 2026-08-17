import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import type { DeviceCommandKind } from "@/server/devices/commands"
import { enqueueDeviceCommandForOperator } from "@/server/devices/devices-service"
import {
  mapOperatorDeviceError,
  resolveOperatorDeviceWriteContext,
} from "@/server/devices/operator-context"
import { operatorJson } from "@/server/operator/http"

const createCommandSchema = z.object({
  deviceId: z.string().uuid(),
  kind: z.enum(["apply_config", "reset", "reboot"]),
  payload: z.record(z.unknown()).optional(),
  expiresInSeconds: z.number().int().positive().max(86400).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveOperatorDeviceWriteContext(req)
    if ("error" in resolved) {
      return resolved.error
    }

    const body = createCommandSchema.parse(await req.json())
    const command = await enqueueDeviceCommandForOperator(resolved.context, {
      deviceId: body.deviceId,
      kind: body.kind as DeviceCommandKind,
      payload: body.payload,
      expiresInSeconds: body.expiresInSeconds,
    })

    return operatorJson({ command }, 201)
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}
