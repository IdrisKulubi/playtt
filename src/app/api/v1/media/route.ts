import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  mapMediaServiceError,
  mediaError,
  mediaJson,
} from "@/server/media/http"
import { createMediaAssetForSession } from "@/server/media/service"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

const bodySchema = z.object({
  playSessionId: z.string().uuid(),
  kind: z.enum(["source_video", "preview_image", "derived_video"]),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionWithBearerFallback(req)

    if (!session) {
      return mediaError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    let requestBody: unknown

    try {
      requestBody = await req.json()
    } catch {
      return mediaError({
        code: "INVALID_BODY",
        message: "Invalid request body.",
        status: 400,
      })
    }

    const body = bodySchema.parse(requestBody)
    const context = await resolveTenantContextForSessionUser(
      session.user.id,
      req.headers.get("x-tenant-id"),
    )
    const result = await createMediaAssetForSession({
      context,
      userId: session.user.id,
      playSessionId: body.playSessionId,
      kind: body.kind,
    })

    return mediaJson(result, 201)
  } catch (error) {
    return mapMediaServiceError(error)
  }
}
