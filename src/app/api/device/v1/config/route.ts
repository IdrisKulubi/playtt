import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { createCorrelationId } from "@/server/tenancy/correlation"
import { requireDeviceRequest } from "@/server/devices/auth"
import { getDeviceConfigForAuthenticatedDevice } from "@/server/devices/devices"
import { mapDeviceError } from "@/server/devices/http"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireDeviceRequest(req)
    const config = await getDeviceConfigForAuthenticatedDevice({
      tenantId: auth.device.tenantId,
      deviceId: auth.device.id,
      deviceStatus: auth.device.status,
    })

    return Response.json({
      data: {
        configVersion: config.configVersion,
        assignment: {
          id: config.assignment.id,
          locationId: config.assignment.locationId,
          effectiveFrom: config.assignment.effectiveFrom,
          effectiveTo: config.assignment.effectiveTo,
        },
        resourceId: config.resourceId,
        role: config.role,
        config: config.config,
      },
    })
  } catch (error) {
    return mapDeviceError(error)
  }
}
