import { NextResponse, type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  applyOnboardingPatch,
  onboardingPatchSchema,
} from "@/server/users/onboarding"
import { mapUserRouteError } from "@/server/users/http"
import { serializeUserProfile } from "@/server/users/profile"

export async function PATCH(req: NextRequest) {
  try {
    const resolvedSession = await getSessionWithBearerFallback(req)

    if (!resolvedSession) {
      return NextResponse.json(
        {
          code: "UNAUTHENTICATED",
          message: "Sign in is required.",
        },
        { status: 401 },
      )
    }

    let body: unknown

    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        {
          code: "INVALID_BODY",
          message: "Invalid request body.",
        },
        { status: 400 },
      )
    }

    const parsed = onboardingPatchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid onboarding data.",
          issues: parsed.error.issues,
        },
        { status: 400 },
      )
    }

    const result = await applyOnboardingPatch(
      resolvedSession.user.id,
      parsed.data,
    )

    if (!result.ok) {
      return NextResponse.json(
        {
          code: result.code,
          message: result.message,
        },
        { status: result.status },
      )
    }

    return NextResponse.json({
      data: {
        user: serializeUserProfile(result.user),
      },
    })
  } catch (error) {
    return mapUserRouteError(error)
  }
}
