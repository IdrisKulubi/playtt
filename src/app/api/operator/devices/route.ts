import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  createEnrollmentForOperator,
  listDevicesForOperator,
  revokeDeviceForOperator,
  rotateDeviceCredentialForOperator,
} from "@/server/devices/devices-service"
import {
  mapOperatorDeviceError,
  resolveOperatorDeviceReadContext,
  resolveOperatorDeviceWriteContext,
} from "@/server/devices/operator-context"
import { operatorJson } from "@/server/operator/http"

const createEnrollmentSchema = z.object({
  locationId: z.string().uuid(),
  deviceType: z.enum(["esp32_controller", "ttlock_lock", "ttlock_gateway"]),
  expiresInMinutes: z.number().int().positive().max(1440).optional(),
})

const revokeSchema = z.object({
  deviceId: z.string().uuid(),
})

const rotateSchema = z.object({
  deviceId: z.string().uuid(),
})

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveOperatorDeviceReadContext(req)
    if ("error" in resolved) {
      return resolved.error
    }

    const locationId = req.nextUrl.searchParams.get("locationId")
    const devices = await listDevicesForOperator(
      resolved.context,
      locationId ?? undefined,
    )

    return operatorJson({ devices })
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveOperatorDeviceWriteContext(req)
    if ("error" in resolved) {
      return resolved.error
    }

    const body = createEnrollmentSchema.parse(await req.json())
    const enrollment = await createEnrollmentForOperator(resolved.context, body)
    return operatorJson({ enrollment }, 201)
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const resolved = await resolveOperatorDeviceWriteContext(req)
    if ("error" in resolved) {
      return resolved.error
    }

    const body = await req.json()
    const action = body?.action

    if (action === "revoke") {
      const input = revokeSchema.parse(body)
      const device = await revokeDeviceForOperator(
        resolved.context,
        input.deviceId,
      )
      return operatorJson({ device })
    }

    if (action === "rotate") {
      const input = rotateSchema.parse(body)
      const rotated = await rotateDeviceCredentialForOperator(
        resolved.context,
        input.deviceId,
      )
      return operatorJson({ rotated })
    }

    return mapOperatorDeviceError(
      new Error("Unsupported device action."),
    )
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}
