import { and, eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"

import db from "../../../../../db/drizzle"
import { account, session, user } from "../../../../../db/schema"
import { verifyAppleToken } from "@/lib/verify-apple-token"

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90

type AppleAuthBody = {
  identityToken?: string
  authorizationCode?: string
  fullName?: {
    givenName?: string | null
    familyName?: string | null
  }
  email?: string
}

export async function POST(req: NextRequest) {
  let body: AppleAuthBody

  try {
    body = (await req.json()) as AppleAuthBody
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body." },
      { status: 400 },
    )
  }

  const identityToken = body.identityToken?.trim()
  if (!identityToken) {
    return NextResponse.json(
      { success: false, message: "identityToken is required." },
      { status: 400 },
    )
  }

  const claims = await verifyAppleToken(identityToken)
  if (!claims) {
    return NextResponse.json(
      { success: false, message: "Invalid Apple identity token." },
      { status: 401 },
    )
  }

  const email =
    claims.email ||
    body.email?.trim().toLowerCase() ||
    `${claims.sub}@privaterelay.appleid.com`

  const fullName = formatFullName(body.fullName)
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  const userAgent = req.headers.get("user-agent")

  let isNewUser = false
  let resolvedUser:
    | {
        id: string
        name: string
        email: string
        emailVerified: boolean
        image: string | null
      }
    | undefined

  const existingAccount = await db.query.account.findFirst({
    where: and(
      eq(account.providerId, "apple"),
      eq(account.accountId, claims.sub),
    ),
    with: { user: true },
  })

  if (existingAccount?.user) {
    resolvedUser = {
      id: existingAccount.user.id,
      name: existingAccount.user.name,
      email: existingAccount.user.email,
      emailVerified: existingAccount.user.emailVerified,
      image: existingAccount.user.image,
    }

    if (body.authorizationCode) {
      await db
        .update(account)
        .set({ accessToken: body.authorizationCode })
        .where(eq(account.id, existingAccount.id))
    }
  } else {
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, email),
    })

    if (existingUser) {
      resolvedUser = {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        emailVerified: existingUser.emailVerified,
        image: existingUser.image,
      }

      await db.insert(account).values({
        id: crypto.randomUUID(),
        providerId: "apple",
        accountId: claims.sub,
        userId: existingUser.id,
        accessToken: body.authorizationCode ?? null,
        idToken: identityToken,
      })
    } else {
      isNewUser = true
      const userId = crypto.randomUUID()
      const name = fullName || "User"

      await db.insert(user).values({
        id: userId,
        name,
        email,
        emailVerified: claims.emailVerified,
      })

      await db.insert(account).values({
        id: crypto.randomUUID(),
        providerId: "apple",
        accountId: claims.sub,
        userId,
        accessToken: body.authorizationCode ?? null,
        idToken: identityToken,
      })

      resolvedUser = {
        id: userId,
        name,
        email,
        emailVerified: claims.emailVerified,
        image: null,
      }
    }
  }

  if (!resolvedUser) {
    return NextResponse.json(
      { success: false, message: "Failed to resolve user." },
      { status: 500 },
    )
  }

  if (fullName && (isNewUser || resolvedUser.name === "User")) {
    await db
      .update(user)
      .set({ name: fullName })
      .where(eq(user.id, resolvedUser.id))
    resolvedUser = { ...resolvedUser, name: fullName }
  }

  const sessionToken = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)

  await db.insert(session).values({
    id: crypto.randomUUID(),
    token: sessionToken,
    userId: resolvedUser.id,
    expiresAt,
    ipAddress,
    userAgent,
  })

  await db
    .update(user)
    .set({ lastLoginAt: new Date() })
    .where(eq(user.id, resolvedUser.id))

  return NextResponse.json({
    success: true,
    data: {
      user: resolvedUser,
      token: sessionToken,
      isNewUser,
    },
  })
}

function formatFullName(fullName?: AppleAuthBody["fullName"]) {
  if (!fullName) {
    return null
  }

  const parts = [fullName.givenName, fullName.familyName].filter(Boolean)
  return parts.length > 0 ? parts.join(" ") : null
}
