import { and, eq, ne } from "drizzle-orm"
import { z } from "zod"

import db from "../../../db/drizzle"
import { user, userSkillLevelEnum } from "../../../db/schema"

export const REFERRAL_SOURCES = [
  "friend",
  "social_media",
  "gym_or_club",
  "search",
  "event",
  "other",
] as const

export const PLAY_INTENTS = [
  "casual",
  "training",
  "compete",
  "curious",
] as const

export type ReferralSource = (typeof REFERRAL_SOURCES)[number]
export type PlayIntent = (typeof PLAY_INTENTS)[number]

const skillLevels = userSkillLevelEnum.enumValues

export const onboardingStep1Schema = z.object({
  step: z.literal(1),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  skillLevel: z.enum(skillLevels),
  phone: z.string().trim().min(1, "Phone number is required"),
})

export const onboardingStep2Schema = z.object({
  step: z.literal(2),
  referralSource: z.enum(REFERRAL_SOURCES),
  playIntent: z.enum(PLAY_INTENTS),
  earlyAdopterOptIn: z.boolean().optional().default(false),
})

export const onboardingPatchSchema = z.discriminatedUnion("step", [
  onboardingStep1Schema,
  onboardingStep2Schema,
])

export type OnboardingPatchInput = z.infer<typeof onboardingPatchSchema>

export function normalizeKenyaPhone(input: string) {
  const digits = input.replace(/\D/g, "")

  if (digits.startsWith("254") && digits.length === 12) {
    return `+${digits}`
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `+254${digits.slice(1)}`
  }

  if (digits.length === 9) {
    return `+254${digits}`
  }

  return null
}

export function resolvePostAuthRoute(onboardingCompletedAt: Date | null | undefined) {
  return onboardingCompletedAt ? "/(app)/(tabs)" : "/onboarding"
}

export async function getUserProfileById(userId: string) {
  return db.query.user.findFirst({
    where: eq(user.id, userId),
  })
}

export async function applyOnboardingPatch(
  userId: string,
  input: OnboardingPatchInput,
) {
  if (input.step === 1) {
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

  const current = await getUserProfileById(userId)

  if (!current?.phone?.trim() || !current.name.trim()) {
    return {
      ok: false as const,
      status: 400,
      code: "ONBOARDING_INCOMPLETE",
      message: "Complete your player profile before finishing onboarding.",
    }
  }

  const [updated] = await db
    .update(user)
    .set({
      referralSource: input.referralSource,
      playIntent: input.playIntent,
      earlyAdopterOptIn: input.earlyAdopterOptIn ?? false,
      onboardingCompletedAt: new Date(),
    })
    .where(eq(user.id, userId))
    .returning()

  return { ok: true as const, user: updated }
}
