import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  assignDeviceForOperator,
  endDeviceAssignmentForOperator,
} from "@/server/devices/devices-service"
import {
  mapOperatorDeviceError,
  resolveOperatorDeviceWriteContext,
} from "@/server/devices/operator-context"
import { operatorJson } from "@/server/operator/http"

const assignSchema = z.object({
  deviceId: z.string().uuid(),
  locationId: z.string().uuid(),
  resourceId: z.string().uuid().nullable().optional(),
  role: z.enum(["score_input", "lock", "gateway", "display"]),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  config: z.record(z.unknown()).optional(),
  configVersion: z.number().int().positive().optional(),
})

const endSchema = z.object({
  assignmentId: z.string().uuid(),
  effectiveTo: z.string().datetime().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveOperatorDeviceWriteContext(req)
    if ("error" in resolved) {
      return resolved.error
    }

    const body = await req.json()
    const action = body?.action ?? "assign"

    if (action === "end") {
      const input = endSchema.parse(body)
      const assignment = await endDeviceAssignmentForOperator(
        resolved.context,
        input.assignmentId,
        input.effectiveTo,
      )
      return operatorJson({ assignment })
    }

    const input = assignSchema.parse(body)
    const assignment = await assignDeviceForOperator(resolved.context, input)
    return operatorJson({ assignment }, 201)
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}
