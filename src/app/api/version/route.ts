import { NextResponse } from "next/server"

import {
  getAppleAllowedAudiences,
  getAppleExpoClientId,
} from "@/lib/verify-apple-token"

export const dynamic = "force-dynamic"

export function GET() {
  const audiences = getAppleAllowedAudiences()

  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    appleSignInRoute: "/api/apple/sign-in",
    apple: {
      clientId: Boolean(process.env.APPLE_CLIENT_ID),
      clientSecret: Boolean(process.env.APPLE_CLIENT_SECRET),
      bundleId: process.env.APPLE_APP_BUNDLE_IDENTIFIER ?? null,
      expoClientId: getAppleExpoClientId(),
      audienceCount: audiences.length,
      audiences,
    },
  })
}
