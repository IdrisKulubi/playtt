import { NextResponse, type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import { getUserProfileById, resolvePostAuthRoute } from "@/server/users/onboarding"
import {
  getUserAuthMethods,
  serializeUserProfile,
} from "@/server/users/profile"
import { mapUserRouteError } from "@/server/users/http"

export async function GET(req: NextRequest) {
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

    const profile = await getUserProfileById(resolvedSession.user.id)

    if (!profile) {
      return NextResponse.json(
        {
          code: "USER_NOT_FOUND",
          message: "User profile not found.",
        },
        { status: 404 },
      )
    }

    const authMethods = await getUserAuthMethods(resolvedSession.user.id)

    return NextResponse.json(
      {
        data: {
          user: {
            ...serializeUserProfile(profile),
            authMethods,
          },
          session: {
            id: resolvedSession.session.id,
            userId: resolvedSession.session.userId,
            expiresAt: resolvedSession.session.expiresAt.toISOString(),
          },
          route: resolvePostAuthRoute(profile.onboardingCompletedAt),
        },
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    )
  } catch (error) {
    return mapUserRouteError(error)
  }
}
