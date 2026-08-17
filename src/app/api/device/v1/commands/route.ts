import { type NextRequest } from "next/server"

import { requireDeviceRequest } from "@/server/devices/auth"
import { postgresDeviceCommandBus } from "@/server/devices/commands"
import { mapDeviceError } from "@/server/devices/http"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireDeviceRequest(req)

    const commands = await postgresDeviceCommandBus.listPendingForDevice(
      auth.device.tenantId,
      auth.device.id,
    )

    const delivered = await Promise.all(
      commands.map(async (command) => {
        if (command.status === "pending") {
          return (
            (await postgresDeviceCommandBus.markDelivered(
              auth.device.tenantId,
              auth.device.id,
              command.id,
            )) ?? command
          )
        }

        return command
      }),
    )

    return Response.json({
      data: {
        commands: delivered.map((command) => ({
          id: command.id,
          kind: command.kind,
          payload: command.payload,
          expiresAt: command.expiresAt,
          correlationId: command.correlationId,
          attemptCount: command.attemptCount,
        })),
      },
    })
  } catch (error) {
    return mapDeviceError(error)
  }
}
