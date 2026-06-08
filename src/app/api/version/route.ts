import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    apple: {
      clientId: Boolean(process.env.APPLE_CLIENT_ID),
      clientSecret: Boolean(process.env.APPLE_CLIENT_SECRET),
      bundleId: process.env.APPLE_APP_BUNDLE_IDENTIFIER ?? null,
    },
  })
}
