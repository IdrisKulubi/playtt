export const SKILL_LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "pro", label: "Pro" },
] as const

export const REFERRAL_SOURCE_OPTIONS = [
  { value: "friend", label: "Friend" },
  { value: "social_media", label: "Social media" },
  { value: "gym_or_club", label: "Gym or club" },
  { value: "search", label: "Search" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
] as const

export const PLAY_INTENT_OPTIONS = [
  { value: "casual", label: "Casual play" },
  { value: "training", label: "Training" },
  { value: "compete", label: "Compete" },
  { value: "curious", label: "Curious about autonomous tables" },
] as const

export type SkillLevel = (typeof SKILL_LEVEL_OPTIONS)[number]["value"]
export type ReferralSource = (typeof REFERRAL_SOURCE_OPTIONS)[number]["value"]
export type PlayIntent = (typeof PLAY_INTENT_OPTIONS)[number]["value"]
