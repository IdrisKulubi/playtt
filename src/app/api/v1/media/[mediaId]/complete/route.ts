import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  mapMediaServiceError,
  mediaError,
  mediaJson,
} from "@/server/media/http"
import { completeMediaUpload } from "@/server/media/service"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

const bodySchema = z
  .object({
    checksumSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/i)
      .optional(),
  })
  .optional()

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ mediaId: string }> },
) {
  try {
    const session = await getSessionWithBearerFallback(req)

    if (!session) {
      return mediaError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    const { mediaId } = await context.params
    let requestBody: unknown = {}

    try {
      const text = await req.text()
      requestBody = text ? JSON.parse(text) : {}
    } catch {
      return mediaError({
        code: "INVALID_BODY",
        message: "Invalid request body.",
        status: 400,
      })
    }

    const body = bodySchema.parse(requestBody)
    const tenantContext = await resolveTenantContextForSessionUser(
      session.user.id,
      req.headers.get("x-tenant-id"),
    )
    const result = await completeMediaUpload({
      context: tenantContext,
      userId: session.user.id,
      mediaId,
      checksumSha256: body?.checksumSha256 ?? null,
    })

    return mediaJson(result)
  } catch (error) {
    return mapMediaServiceError(error)
  }
}
