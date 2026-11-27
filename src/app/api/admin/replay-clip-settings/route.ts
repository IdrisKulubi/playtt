import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { resolveAdminApiContext } from "@/server/admin/api-context"
import { mapOperatorError, operatorError, operatorJson } from "@/server/operator/http"
import {
  getReplayClipSettingsForAdmin,
  setReplayClipDurationForAdmin,
} from "@/server/replays/clip-settings"
import {
  MAX_REPLAY_CLIP_SECONDS,
  MIN_REPLAY_CLIP_SECONDS,
} from "@/server/replays/constants"

const updateSchema = z.object({
  clipDurationSeconds: z
    .number()
    .int()
    .min(MIN_REPLAY_CLIP_SECONDS)
    .max(MAX_REPLAY_CLIP_SECONDS),
})

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved
    return operatorJson(await getReplayClipSettingsForAdmin(resolved.context))
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
        message: `Clip length must be a whole number of seconds from ${MIN_REPLAY_CLIP_SECONDS} to ${MAX_REPLAY_CLIP_SECONDS}.`,
        status: 400,
      })
    }

    const settings = await setReplayClipDurationForAdmin(
      resolved.context,
      parsed.data.clipDurationSeconds,
    )
    return operatorJson(settings)
  } catch (error) {
    return mapOperatorError(error)
  }
}
