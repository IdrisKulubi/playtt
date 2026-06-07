import type { NextRequest } from "next/server"
import { eq } from "drizzle-orm"

import { auth } from "../../auth"
import db from "../../db/drizzle"
import { session as sessionTable } from "../../db/schema"

export type AuthenticatedRequestSession = {
  session: {
    id: string
    token: string
    userId: string
    expiresAt: Date
  }
  user: {
    id: string
    name: string
    email: string
    emailVerified: boolean
    image?: string | null
  }
}

export async function getSessionWithBearerFallback(
  req: NextRequest
): Promise<AuthenticatedRequestSession | null> {
  const betterAuthSession = await auth.api.getSession({ headers: req.headers })

  if (betterAuthSession?.session && betterAuthSession.user) {
    return {
      session: {
        id: betterAuthSession.session.id,
        token: betterAuthSession.session.token,
        userId: betterAuthSession.session.userId,
        expiresAt: betterAuthSession.session.expiresAt,
      },
      user: {
        id: betterAuthSession.user.id,
        name: betterAuthSession.user.name,
        email: betterAuthSession.user.email,
        emailVerified: betterAuthSession.user.emailVerified,
        image: betterAuthSession.user.image,
      },
    }
  }

  const bearerToken = getBearerToken(req)
  if (!bearerToken) {
    return null
  }

  const dbSession = await db.query.session.findFirst({
    where: eq(sessionTable.token, bearerToken),
    with: {
      user: true,
    },
  })

  if (!dbSession || dbSession.expiresAt <= new Date()) {
    return null
  }

  return {
    session: {
      id: dbSession.id,
      token: dbSession.token,
      userId: dbSession.userId,
      expiresAt: dbSession.expiresAt,
    },
    user: {
      id: dbSession.user.id,
      name: dbSession.user.name,
      email: dbSession.user.email,
      emailVerified: dbSession.user.emailVerified,
      image: dbSession.user.image,
    },
  }
}

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return null
  }

  const token = authHeader.slice("Bearer ".length).trim().split(".")[0]
  return token || null
}
