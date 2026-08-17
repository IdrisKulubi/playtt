import { type NextRequest } from "next/server"

import { requireDeviceRequest } from "@/server/devices/auth"
import { rotateDeviceCredential } from "@/server/devices/devices"
import { mapDeviceError } from "@/server/devices/http"

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDeviceRequest(req)
    const rotated = await rotateDeviceCredential({
      deviceId: auth.device.id,
      tenantId: auth.device.tenantId,
    })

    return Response.json({
      data: {
        secret: rotated.secret,
        credentialVersion: rotated.credentialVersion,
      },
    })
  } catch (error) {
    return mapDeviceError(error)
  }
}
