import { NextResponse, type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import { getUserProfileById, resolvePostAuthRoute } from "@/server/users/onboarding"
import {
  getUserAuthMethods,
  serializeUserProfile,
} from "@/server/users/profile"
import { deleteUserAccount } from "@/server/users/delete-account"
import { mapUserRouteError, userError } from "@/server/users/http"

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

/** Permanently delete the signed-in player's account (App Store 5.1.1(v)). */
export async function DELETE(req: NextRequest) {
  try {
    const resolvedSession = await getSessionWithBearerFallback(req)
    if (!resolvedSession) {
      return userError({ code: "UNAUTHENTICATED", message: "Sign in is required.", status: 401 })
    }

    const result = await deleteUserAccount(resolvedSession.user.id)
    if (!result.ok) {
      return userError({
        code: result.code,
        message: result.message,
        status: result.code === "ACTIVE_BOOKINGS" ? 409 : 404,
      })
    }

    return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } })
  } catch (error) {
    return mapUserRouteError(error)
  }
}
