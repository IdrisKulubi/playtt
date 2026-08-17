import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { requireDeviceRequest } from "@/server/devices/auth"
import { postgresDeviceCommandBus } from "@/server/devices/commands"
import { mapDeviceError } from "@/server/devices/http"

const ackSchema = z.object({
  idempotencyKey: z.string().trim().min(1),
  success: z.boolean(),
  result: z.record(z.unknown()).optional(),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ commandId: string }> },
) {
  try {
    const auth = await requireDeviceRequest(req)
    const { commandId } = await context.params
    const body = ackSchema.parse(await req.json())

    const command = await postgresDeviceCommandBus.acknowledge({
      tenantId: auth.device.tenantId,
      deviceId: auth.device.id,
      commandId,
      idempotencyKey: body.idempotencyKey,
      success: body.success,
      result: body.result,
    })

    return Response.json({
      data: {
        command: {
          id: command.id,
          status: command.status,
          acknowledgedAt: command.acknowledgedAt,
          failedAt: command.failedAt,
          result: command.result,
        },
      },
    })
  } catch (error) {
    return mapDeviceError(error)
  }
}
