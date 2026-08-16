import { NextResponse } from "next/server"

import { getPublicVersionInfo } from "@/lib/public-version"

export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json(
    getPublicVersionInfo(process.env.VERCEL_GIT_COMMIT_SHA),
  )
}
