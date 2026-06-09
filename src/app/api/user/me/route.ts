import { NextResponse, type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  getUserProfileById,
  resolvePostAuthRoute,
} from "@/server/users/onboarding"

export async function GET(req: NextRequest) {
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

  return NextResponse.json(
    {
      data: {
        user: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          emailVerified: profile.emailVerified,
          image: profile.image,
          phone: profile.phone,
          skillLevel: profile.skillLevel,
          referralSource: profile.referralSource,
          playIntent: profile.playIntent,
          earlyAdopterOptIn: profile.earlyAdopterOptIn,
          onboardingCompletedAt:
            profile.onboardingCompletedAt?.toISOString() ?? null,
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
}
