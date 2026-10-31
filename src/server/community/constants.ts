// Shared community limits and option keys. Mirrored in
// playtt-mobile/lib/community-types.ts — keep both in sync.

export const PLAY_AVAILABILITY_WINDOWS = [
  "now",
  "today",
  "tonight",
  "weekend",
] as const

export type PlayAvailabilityWindow = (typeof PLAY_AVAILABILITY_WINDOWS)[number]

export const USUAL_TIME_KEYS = [
  "weekday_mornings",
  "weekday_lunch",
  "weekday_evenings",
  "sat_mornings",
  "sat_afternoons",
  "sun_mornings",
  "sun_afternoons",
  "late_night",
] as const

export type UsualTimeKey = (typeof USUAL_TIME_KEYS)[number]

export const COMMUNITY_PLAY_STYLES = ["attacker", "defender", "all_round"] as const
export const COMMUNITY_HANDEDNESS = ["right", "left"] as const
export const COMMUNITY_REQUEST_POLICIES = [
  "everyone",
  "followers",
  "rally_partners",
] as const

export type CommunityRequestPolicy = (typeof COMMUNITY_REQUEST_POLICIES)[number]

export const COMMUNITY_REPORT_REASONS = [
  "spam",
  "harassment",
  "inappropriate",
  "no_show",
  "other",
] as const

export const COMMUNITY_LIMITS = {
  bioMaxLength: 140,
  availabilityNoteMaxLength: 80,
  reportNoteMaxLength: 500,
  usualTimesMax: USUAL_TIME_KEYS.length,
  pageSize: 30,
  nowWindowMinutes: 120,
  tonightStartHour: 17,
  tonightEndHour: 23,
} as const

export const COMMUNITY_RATE_LIMITS = {
  follow: { max: 60, windowMs: 60 * 60_000 },
  availability: { max: 10, windowMs: 60 * 60_000 },
  report: { max: 20, windowMs: 24 * 60 * 60_000 },
} as const

export type CommunityRateLimitScope = keyof typeof COMMUNITY_RATE_LIMITS
