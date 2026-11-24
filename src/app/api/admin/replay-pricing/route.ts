import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { resolveAdminApiContext } from "@/server/admin/api-context"
import { mapOperatorError, operatorError, operatorJson } from "@/server/operator/http"
import {
  MAX_CLIP_PRICE_KES,
  MIN_CLIP_PRICE_KES,
  getReplayClipPricingForAdmin,
  setReplayClipPriceForAdmin,
} from "@/server/replays/pricing"

const updateSchema = z.object({
  unitPriceKes: z.number().int().min(MIN_CLIP_PRICE_KES).max(MAX_CLIP_PRICE_KES),
})

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved
    return operatorJson(await getReplayClipPricingForAdmin(resolved.context))
  } catch (error) {
    return mapOperatorError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const parsed = updateSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return operatorError({
        code: "VALIDATION_ERROR",
        message: `Price per clip must be a whole number between ${MIN_CLIP_PRICE_KES} and ${MAX_CLIP_PRICE_KES.toLocaleString("en-KE")} KES.`,
        status: 400,
      })
    }

    const pricing = await setReplayClipPriceForAdmin(resolved.context, parsed.data.unitPriceKes)
    return operatorJson(pricing)
  } catch (error) {
    return mapOperatorError(error)
  }
}
