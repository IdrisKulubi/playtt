import { and, eq, ne } from "drizzle-orm"
import { z } from "zod"

import db from "../../../db/drizzle"
import { account, user, userSkillLevelEnum } from "../../../db/schema"

import { normalizeKenyaPhone } from "./onboarding"

const skillLevels = userSkillLevelEnum.enumValues

export const AUTH_PROVIDERS = ["credential", "google", "apple"] as const
export type AuthProvider = (typeof AUTH_PROVIDERS)[number]

export const profilePatchSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  skillLevel: z.enum(skillLevels),
  phone: z.string().trim().min(1, "Phone number is required"),
})

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>

export function serializeUserProfile(profile: typeof user.$inferSelect) {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    emailVerified: profile.emailVerified,
    image: profile.image,
    phone: profile.phone,
    skillLevel: profile.skillLevel,
    referralSource: profile.referralSource,
    playIntent: profile.playIntent,
    earlyAdopterOptIn: profile.earlyAdopterOptIn,
    onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
  }
}

export async function getUserAuthMethods(userId: string) {
  const accounts = await db.query.account.findMany({
    where: eq(account.userId, userId),
    columns: {
      providerId: true,
      password: true,
    },
  })

  const providers = new Set<AuthProvider>()

  for (const row of accounts) {
    if (row.providerId === "credential") {
      providers.add("credential")
    } else if (row.providerId === "google") {
      providers.add("google")
    } else if (row.providerId === "apple") {
      providers.add("apple")
    }
  }

  const hasPassword = accounts.some(
    (row) => row.providerId === "credential" && Boolean(row.password),
  )

  return {
    providers: Array.from(providers),
    hasPassword,
  }
}

export async function applyProfilePatch(userId: string, input: ProfilePatchInput) {
  const phone = normalizeKenyaPhone(input.phone)

  if (!phone) {
    return {
      ok: false as const,
      status: 400,
      code: "INVALID_PHONE",
      message: "Enter a valid Kenyan phone number (e.g. 07XX XXX XXX).",
    }
  }

  const existingPhone = await db.query.user.findFirst({
    where: and(eq(user.phone, phone), ne(user.id, userId)),
  })

  if (existingPhone) {
    return {
      ok: false as const,
      status: 409,
      code: "PHONE_IN_USE",
      message: "That phone number is already linked to another account.",
    }
  }

  const [updated] = await db
    .update(user)
    .set({
      name: input.name.trim(),
      skillLevel: input.skillLevel,
      phone,
    })
    .where(eq(user.id, userId))
    .returning()

  return { ok: true as const, user: updated }
}
