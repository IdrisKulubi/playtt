import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { resolveAdminApiContext } from "@/server/admin/api-context"
import { excuseMissedBooking } from "@/server/community/admin-service"
import { mapOperatorError, operatorJson } from "@/server/operator/http"

const overrideSchema = z.object({
  bookingId: z.string().uuid(),
  userId: z.string().min(1).max(128),
  reason: z.string().trim().min(3).max(500),
})

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const body = overrideSchema.parse(await req.json())
    return operatorJson(await excuseMissedBooking(resolved.context, resolved.userId, body))
  } catch (error) {
    return mapOperatorError(error)
  }
}
