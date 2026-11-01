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
  message: { max: 30, windowMs: 60_000 },
  conversation: { max: 20, windowMs: 24 * 60 * 60_000 },
} as const

export type CommunityRateLimitScope = keyof typeof COMMUNITY_RATE_LIMITS

// --- Chat (M3) ---

export const CONVERSATION_FOLDERS = ["inbox", "requests"] as const
export type ConversationFolder = (typeof CONVERSATION_FOLDERS)[number]

/** Kinds a client may send; kudos_prompt and system are server-only. */
export const SENDABLE_MESSAGE_KINDS = ["text", "quick_reply", "booking_card"] as const
export type SendableMessageKind = (typeof SENDABLE_MESSAGE_KINDS)[number]

export const QUICK_REPLIES = [
  "What time works for you?",
  "I'll book the table",
  "Running 10 min late",
  "Good game! 🏓",
] as const

export const CHAT_LIMITS = {
  messageMaxLength: 1000,
  messagesPageSize: 50,
  conversationsPageSize: 30,
  /** Messages a sender may send before the recipient accepts the request. */
  requestMessageLimit: 3,
  clientMessageIdMaxLength: 64,
  pushPreviewLength: 120,
  /** One message push per conversation per recipient in this window. */
  messagePushWindowMs: 60_000,
  /** One "someone you follow is open" push per recipient in this window. */
  followeeOpenPushWindowMs: 6 * 60 * 60_000,
} as const

// --- Social loop (M4) ---

export const KUDOS_TYPES = [
  "great_rallies",
  "fair_play",
  "on_time",
  "fun_to_play",
  "great_serve",
  "good_coach",
] as const

export type KudosType = (typeof KUDOS_TYPES)[number]

export const KUDOS_LABELS: Record<KudosType, string> = {
  great_rallies: "Great rallies",
  fair_play: "Fair play",
  on_time: "On time",
  fun_to_play: "Fun to play",
  great_serve: "Great serve",
  good_coach: "Good coach",
}

/** Earned at KUDOS_BADGE_THRESHOLD kudos of one type. */
export const KUDOS_BADGES: Record<KudosType, string> = {
  great_rallies: "rally_ace",
  fair_play: "fair_play",
  on_time: "clockwork",
  fun_to_play: "good_vibes",
  great_serve: "ace_server",
  good_coach: "mentor",
}

export const SOCIAL_LIMITS = {
  kudosBadgeThreshold: 10,
  maxKudosTypesPerMatch: 3,
  kudosWindowMs: 72 * 60 * 60_000,
  lateWithdrawalMs: 2 * 60 * 60_000,
  reliabilityMinBookings: 3,
  reliableBadgeMinBookings: 5,
  reliableBadgePercent: 90,
  rallyPartnersMax: 12,
  muteDays: 7,
} as const

export const PLAY_AGAIN_PREFILL = "Rematch? 🏓"
