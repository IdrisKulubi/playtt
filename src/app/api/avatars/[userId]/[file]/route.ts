import { NextResponse, type NextRequest } from "next/server"

import { AVATAR_RULES, parseAvatarParams } from "@/server/users/avatar-rules"
import { avatarDownloadUrl } from "@/server/users/avatar"

// Public: player cards show photos to other players and image loaders can't
// send auth headers. File names are random UUIDs, and the bucket stays private
// behind a short-lived signed redirect.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string; file: string }> },
) {
  const { userId, file } = await params
  const parsed = parseAvatarParams(decodeURIComponent(userId), file)
  if (!parsed) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Photo not found." }, { status: 404 })
  }

  try {
    const url = await avatarDownloadUrl(parsed.objectKey)
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": `public, max-age=${AVATAR_RULES.redirectCacheSeconds}` },
    })
  } catch {
    return NextResponse.json({ code: "AVATAR_UNAVAILABLE", message: "Photo is unavailable." }, { status: 503 })
  }
}
