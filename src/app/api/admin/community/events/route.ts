import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { resolveAdminApiContext } from "@/server/admin/api-context"
import { createEvent } from "@/server/community/group-service"
import { mapOperatorError, operatorJson } from "@/server/operator/http"

const eventSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(500).optional(),
  startsAt: z.string().datetime({ offset: true }),
  maxMembers: z.number().int().min(2).max(64),
  locationId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const body = eventSchema.parse(await req.json())
    return operatorJson(
      await createEvent(resolved.context, resolved.userId, {
        ...body,
        startsAt: new Date(body.startsAt),
      }),
      201,
    )
  } catch (error) {
    return mapOperatorError(error)
  }
}
