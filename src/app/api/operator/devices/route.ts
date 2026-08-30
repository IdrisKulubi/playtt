import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  createEnrollmentForOperator,
  issueProvisionedDeviceForOperator,
  listDevicesForOperator,
  revokeDeviceForOperator,
  deleteDeviceForOperator,
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
  deviceType: z.enum([
    "esp32_controller",
    "ttlock_lock",
    "ttlock_gateway",
    "venue_edge",
    "camera",
  ]),
  expiresInMinutes: z.number().int().positive().max(1440).optional(),
  issueCredentials: z.boolean().optional(),
  hardwareUid: z.string().trim().min(1).max(160).optional(),
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
    const shouldIssueCredentials =
      body.issueCredentials === true ||
      body.deviceType === "venue_edge" ||
      body.deviceType === "camera"

    if (shouldIssueCredentials) {
      const credentials = await issueProvisionedDeviceForOperator(
        resolved.context,
        {
          locationId: body.locationId,
          deviceType: body.deviceType,
          hardwareUid: body.hardwareUid,
          expiresInMinutes: body.expiresInMinutes,
        },
      )
      return operatorJson({ credentials }, 201)
    }

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

    if (action === "delete") {
      const input = revokeSchema.parse(body)
      const deleted = await deleteDeviceForOperator(
        resolved.context,
        input.deviceId,
      )
      return operatorJson({ deleted })
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
