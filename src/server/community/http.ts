import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getSessionWithBearerFallback } from "@/lib/security"
import { TenancyError } from "@/server/tenancy/errors"
import { resolveTenantContextForUserId } from "@/server/tenancy/resolve-user-context"
import type { TenantContext } from "@/server/tenancy/types"

import {
  COMMUNITY_HANDEDNESS,
  COMMUNITY_LIMITS,
  COMMUNITY_PLAY_STYLES,
  COMMUNITY_REPORT_REASONS,
  COMMUNITY_REQUEST_POLICIES,
  PLAY_AVAILABILITY_WINDOWS,
  USUAL_TIME_KEYS,
} from "./constants.ts"
import { isCommunityError } from "./errors.ts"

const communityNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie, Authorization, x-tenant-id",
}

const optionalTrimmedText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .optional()

export const communityProfilePatchSchema = z
  .object({
    communityVisible: z.boolean().optional(),
    bio: optionalTrimmedText(COMMUNITY_LIMITS.bioMaxLength),
    playStyle: z.enum(COMMUNITY_PLAY_STYLES).nullable().optional(),
    handedness: z.enum(COMMUNITY_HANDEDNESS).nullable().optional(),
    usualTimes: z
      .array(z.enum(USUAL_TIME_KEYS))
      .max(COMMUNITY_LIMITS.usualTimesMax)
      .transform((values) => Array.from(new Set(values)))
      .optional(),
    requestPolicy: z.enum(COMMUNITY_REQUEST_POLICIES).optional(),
    showAtVenue: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  })

export type CommunityProfilePatch = z.infer<typeof communityProfilePatchSchema>

export const communityAvailabilitySchema = z
  .object({
    window: z.enum(PLAY_AVAILABILITY_WINDOWS),
    note: optionalTrimmedText(COMMUNITY_LIMITS.availabilityNoteMaxLength),
    lookingForDoubles: z.boolean().optional(),
  })
  .strict()

export type CommunityAvailabilityInput = z.infer<typeof communityAvailabilitySchema>

const booleanParam = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true")

export const communityPlayersQuerySchema = z.object({
  status: z.enum(["open", "all"]).default("all"),
  skill: z.enum(["beginner", "intermediate", "pro"]).optional(),
  doubles: booleanParam,
  following: booleanParam,
  cursor: z.string().max(64).optional(),
})

export type CommunityPlayersQuery = z.infer<typeof communityPlayersQuerySchema>

export const communityCursorQuerySchema = z.object({
  cursor: z.string().max(64).optional(),
})

export const communityReportSchema = z
  .object({
    targetUserId: z.string().min(1).max(128),
    messageId: z.string().uuid().optional(),
    reason: z.enum(COMMUNITY_REPORT_REASONS),
    note: optionalTrimmedText(COMMUNITY_LIMITS.reportNoteMaxLength),
  })
  .strict()

export type CommunityReportInput = z.infer<typeof communityReportSchema>

export function communityJson<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status, headers: communityNoStoreHeaders })
}

export function communityError(input: { code: string; message: string; status?: number }) {
  return NextResponse.json(
    { code: input.code, message: input.message },
    { status: input.status ?? 400, headers: communityNoStoreHeaders },
  )
}

export function mapCommunityRouteError(error: unknown) {
  if (isCommunityError(error)) {
    return communityError(error)
  }

  if (error instanceof TenancyError) {
    const unauthenticated =
      error.code === "NOT_AUTHENTICATED" ||
      error.code === "MEMBERSHIP_NOT_FOUND" ||
      error.code === "MEMBERSHIP_DISABLED"
    return communityError({
      code: error.code,
      message: error.message,
      status: unauthenticated ? 401 : 403,
    })
  }

  console.error("[community] Unexpected route error", error)
  return communityError({
    code: "COMMUNITY_ERROR",
    message: "Something went wrong in Community. Please try again.",
    status: 500,
  })
}

export type CommunityRequestContext = { userId: string; tenant: TenantContext }

// Resolves the signed-in user + tenant, runs the handler and maps errors.
export async function withCommunityUser(
  req: NextRequest,
  handler: (context: CommunityRequestContext) => Promise<Response>,
) {
  try {
    const session = await getSessionWithBearerFallback(req)

    if (!session) {
      return communityError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    const tenant = await resolveTenantContextForUserId(session.user.id)
    return await handler({ userId: session.user.id, tenant })
  } catch (error) {
    return mapCommunityRouteError(error)
  }
}

export async function parseJsonBody<T extends z.ZodTypeAny>(
  req: NextRequest,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return {
      ok: false,
      response: communityError({ code: "INVALID_BODY", message: "Invalid request body." }),
    }
  }

  return parseWith(schema, body)
}

export function parseSearchParams<T extends z.ZodTypeAny>(req: NextRequest, schema: T) {
  return parseWith(schema, Object.fromEntries(req.nextUrl.searchParams))
}

function parseWith<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): { ok: true; data: z.infer<T> } | { ok: false; response: Response } {
  const parsed = schema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      response: communityError({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid request.",
      }),
    }
  }

  return { ok: true, data: parsed.data }
}
