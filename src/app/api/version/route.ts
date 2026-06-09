import { NextResponse } from "next/server"

import { buildAppleAudience, isExpoGoTrusted } from "@/lib/apple-audience"

export const dynamic = "force-dynamic"

export function GET() {
  const audiences = buildAppleAudience()

  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    expoGoTrusted: isExpoGoTrusted(),
    apple: {
      clientId: Boolean(process.env.APPLE_CLIENT_ID),
      clientSecret: Boolean(process.env.APPLE_CLIENT_SECRET),
      bundleId: process.env.APPLE_APP_BUNDLE_IDENTIFIER ?? null,
      audienceCount: audiences.length,
      audiences,
    },
  })
}
