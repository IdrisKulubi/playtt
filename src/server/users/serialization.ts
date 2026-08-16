import type { user } from "../../../db/schema"

type UserProfileRecord = typeof user.$inferSelect

export function serializeUserProfile(profile: UserProfileRecord) {
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
