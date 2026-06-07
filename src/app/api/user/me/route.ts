import { NextResponse, type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"

export async function GET(req: NextRequest) {
  const resolvedSession = await getSessionWithBearerFallback(req)

  if (!resolvedSession) {
    return NextResponse.json(
      {
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
      },
      { status: 401 }
    )
  }

  return NextResponse.json(
    {
      data: {
        user: resolvedSession.user,
        session: {
          id: resolvedSession.session.id,
          userId: resolvedSession.session.userId,
          expiresAt: resolvedSession.session.expiresAt.toISOString(),
        },
        route: "/(app)/(tabs)",
      },
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  )
}
