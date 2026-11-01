import { NextResponse, type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  avatarConfirmSchema,
  avatarUploadRequestSchema,
  confirmAvatarUpload,
  createAvatarUpload,
  removeAvatar,
} from "@/server/users/avatar"
import { mapUserRouteError, userError } from "@/server/users/http"

async function readJson(req: NextRequest) {
  try {
    return { ok: true as const, body: (await req.json()) as unknown }
  } catch {
    return { ok: false as const }
  }
}

function unauthenticated() {
  return userError({ code: "UNAUTHENTICATED", message: "Sign in is required.", status: 401 })
}

/** Step 1: get a presigned R2 PUT for a new profile photo. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionWithBearerFallback(req)
    if (!session) return unauthenticated()

    const json = await readJson(req)
    if (!json.ok) return userError({ code: "INVALID_BODY", message: "Invalid request body." })

    const parsed = avatarUploadRequestSchema.safeParse(json.body)
    if (!parsed.success) {
      return userError({ code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid photo." })
    }

    const result = await createAvatarUpload(session.user.id, parsed.data.contentType)
    if (!result.ok) return userError(result)

    return NextResponse.json({ data: result.value })
  } catch (error) {
    return mapUserRouteError(error)
  }
}

/** Step 2: after the PUT, confirm the object and make it the profile photo. */
export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionWithBearerFallback(req)
    if (!session) return unauthenticated()

    const json = await readJson(req)
    if (!json.ok) return userError({ code: "INVALID_BODY", message: "Invalid request body." })

    const parsed = avatarConfirmSchema.safeParse(json.body)
    if (!parsed.success) {
      return userError({ code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid upload." })
    }

    const result = await confirmAvatarUpload(session.user.id, parsed.data.objectKey)
    if (!result.ok) return userError(result)

    return NextResponse.json({ data: result.value })
  } catch (error) {
    return mapUserRouteError(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionWithBearerFallback(req)
    if (!session) return unauthenticated()

    await removeAvatar(session.user.id)
    return NextResponse.json({ data: { image: null } })
  } catch (error) {
    return mapUserRouteError(error)
  }
}
