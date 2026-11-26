import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { requireDeviceRequest } from "@/server/devices/auth"
import { deviceJson, mapDeviceError } from "@/server/devices/http"
import {
  CAMERA_STILL_MAX_BYTES,
  createCameraStillUploadGrant,
} from "@/server/replays/venue-edge-camera-assignments"

const grantSchema = z.object({
  localConnectionKey: z.string().trim().min(1).max(200),
  channelKey: z.string().trim().min(1).max(16),
  contentLength: z.number().int().positive().max(CAMERA_STILL_MAX_BYTES),
})

// The venue PC asks for a short-lived upload URL, then PUTs one JPEG still
// for a camera so the admin can see which camera films which table.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireDeviceRequest(req)
    const body = grantSchema.parse(await req.json())
    const grant = await createCameraStillUploadGrant({
      tenantId: auth.device.tenantId,
      edgeDeviceId: auth.device.id,
      localConnectionKey: body.localConnectionKey,
      channelKey: body.channelKey,
      contentLength: body.contentLength,
    })
    return deviceJson({ grant })
  } catch (error) {
    return mapDeviceError(error)
  }
}
