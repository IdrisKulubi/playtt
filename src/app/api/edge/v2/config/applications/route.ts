import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { requireDeviceRequest } from "@/server/devices/auth"
import { DeviceError } from "@/server/devices/errors"
import { deviceJson, mapDeviceError } from "@/server/devices/http"
import { validateEdgeAgentVersion } from "@/server/replays/edge-agent-version"
import { acknowledgeEdgeConfigV2Application } from "@/server/replays/edge-config-v2-applications"
import { VENUE_EDGE_V2_MINIMUM_AGENT_VERSION } from "@/server/replays/edge-config-v2-repository"

const applicationSchema = z
  .object({
    installationId: z.string().uuid(),
    configRevisionId: z.string().uuid(),
    status: z.enum(["applied", "rejected"]),
    bootId: z.string().trim().min(1).max(200).optional(),
    errorCode: z.string().trim().min(1).max(120).optional(),
    errorDetails: z.record(z.unknown()).optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "rejected" && !value.errorCode) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rejected configuration requires errorCode.",
        path: ["errorCode"],
      })
    }
    if (
      value.status === "applied" &&
      (value.errorCode !== undefined || value.errorDetails !== undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Applied configuration cannot include error details.",
        path: ["status"],
      })
    }
  })

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDeviceRequest(req)
    const version = validateEdgeAgentVersion(
      req.headers.get("x-playtt-edge-agent-version"),
      VENUE_EDGE_V2_MINIMUM_AGENT_VERSION
    )
    if (!version.success) {
      throw new DeviceError(version.code, version.message, 426)
    }
    const body = applicationSchema.parse(await req.json())
    const application = await acknowledgeEdgeConfigV2Application({
      tenantId: auth.device.tenantId,
      locationId: auth.device.locationId,
      deviceId: auth.device.id,
      deviceType: auth.device.type,
      installationId: body.installationId,
      configRevisionId: body.configRevisionId,
      status: body.status,
      bootId: body.bootId,
      errorCode: body.errorCode,
      errorDetails: body.errorDetails,
    })

    return deviceJson(application)
  } catch (error) {
    return mapDeviceError(error)
  }
}
