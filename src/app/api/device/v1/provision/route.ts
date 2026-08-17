import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { hashEnrollmentCode } from "@/server/devices/credentials"
import { provisionDevice } from "@/server/devices/devices"
import { DeviceError } from "@/server/devices/errors"
import { mapDeviceError } from "@/server/devices/http"
import {
  checkProvisionRateLimit,
} from "@/server/devices/provision-rate-limit"
import { createCorrelationId } from "@/server/tenancy/correlation"

const provisionSchema = z.object({
  enrollmentCode: z.string().trim().min(1),
  hardwareUid: z.string().trim().min(1),
  firmwareVersion: z.string().trim().optional(),
})

function getClientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = provisionSchema.parse(await req.json())
    const codeHash = hashEnrollmentCode(body.enrollmentCode)
    const rateKey = `${getClientIp(req)}:${codeHash}`

    if (!checkProvisionRateLimit(rateKey)) {
      throw new DeviceError(
        "PROVISION_RATE_LIMITED",
        "Too many provision attempts. Try again later.",
        429,
      )
    }

    const result = await provisionDevice({
      enrollmentCode: body.enrollmentCode,
      hardwareUid: body.hardwareUid,
      firmwareVersion: body.firmwareVersion,
      correlationId:
        req.headers.get("x-correlation-id") ?? createCorrelationId(),
    })

    return Response.json(
      {
        data: {
          deviceId: result.deviceId,
          secret: result.secret,
          credentialVersion: result.credentialVersion,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return mapDeviceError(error)
  }
}
