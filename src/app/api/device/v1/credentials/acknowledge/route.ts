import { type NextRequest } from "next/server"

import { requireDeviceRequest } from "@/server/devices/auth"
import { acknowledgeDeviceCredentialRotation } from "@/server/devices/devices"
import { mapDeviceError } from "@/server/devices/http"

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDeviceRequest(req)
    const result = await acknowledgeDeviceCredentialRotation({
      deviceId: auth.device.id,
      tenantId: auth.device.tenantId,
      credentialVersion: auth.credentialVersion,
    })

    return Response.json({ data: result })
  } catch (error) {
    return mapDeviceError(error)
  }
}
