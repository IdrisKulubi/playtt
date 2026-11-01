// Mirrors src/server/community/constants.ts and the /api/v1/community responses.

export const PLAY_AVAILABILITY_WINDOWS = ["now", "today", "tonight", "weekend"] as const
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

export type CommunityPlayStyle = "attacker" | "defender" | "all_round"
export type CommunityHandedness = "right" | "left"
export type CommunityRequestPolicy = "everyone" | "followers" | "rally_partners"
export type CommunitySkillLevel = "beginner" | "intermediate" | "pro"
export type CommunityReportReason = "spam" | "harassment" | "inappropriate" | "no_show" | "other"

export type CommunityAvailability = {
  window: PlayAvailabilityWindow
  startsAt: string
  endsAt: string
  note: string | null
  lookingForDoubles: boolean
  openNow: boolean
  /** Doubles group fill when looking for doubles (M5), e.g. 3 of 4. */
  doubles?: { members: number; max: number } | null
}

export type CommunityRelationship = {
  following: boolean
  followsYou: boolean
  rallyPartner: boolean
  blockedByYou: boolean
  canMessage: boolean
}

/** Server-earned card color tier, from card points: blue → purple → pink → gold. */
export type CommunityCardTier = "blue" | "purple" | "pink" | "gold"

/** null = not enough data yet; the card shows a dash, never 0. */
export type CommunityCardStats = {
  /** Card rating 40–99 from card points; null shows NEW when not loaded. */
  rating?: number | null
  /** Points from wins, sessions, coach drills and kudos. */
  points?: number | null
  tier?: CommunityCardTier | null
  /** Points needed for the next tier; null at gold. */
  nextTierPoints?: number | null
  matches: number | null
  winRate: number | null
  reliability: number | null
  streakWeeks: number | null
  kudos: number | null
  hours: number | null
}

export type CommunityPlayer = {
  id: string
  displayName: string
  image: string | null
  skillLevel: CommunitySkillLevel
  playStyle: CommunityPlayStyle | null
  handedness: CommunityHandedness | null
  bio: string | null
  usualTimes: UsualTimeKey[]
  foundingPlayer: boolean
  availability: CommunityAvailability | null
  relationship: CommunityRelationship
  stats: CommunityCardStats
  /** Earned badge keys, e.g. "rally_ace", "reliable" (see KUDOS_BADGE_LABELS). */
  badges: string[]
}

export type CommunityVenueRef = { id: string; name: string }
export type CommunityCounts = { followers: number; following: number }

export type CommunityPlayerDetail = CommunityPlayer & {
  homeVenue: CommunityVenueRef | null
  counts: CommunityCounts
  /** Top 3 kudos types received. */
  kudos: KudosCount[]
}

export type CommunityProfile = {
  communityVisible: boolean
  bio: string | null
  playStyle: CommunityPlayStyle | null
  handedness: CommunityHandedness | null
  usualTimes: UsualTimeKey[]
  requestPolicy: CommunityRequestPolicy
  showAtVenue: boolean
  foundingPlayer: boolean
}

export type CommunityMe = {
  id: string
  displayName: string
  image: string | null
  skillLevel: CommunitySkillLevel
  profile: CommunityProfile
  availability: CommunityAvailability | null
  homeVenue: CommunityVenueRef | null
  counts: CommunityCounts
  stats: CommunityCardStats
  badges: string[]
  kudos: KudosCount[]
}

export type CommunityProfilePatch = Partial<
  Pick<
    CommunityProfile,
    "communityVisible" | "bio" | "playStyle" | "handedness" | "usualTimes" | "requestPolicy" | "showAtVenue"
  >
>

export type GoOpenInput = {
  window: PlayAvailabilityWindow
  note?: string | null
  lookingForDoubles?: boolean
}

export type CommunityPlayersFilters = {
  status?: "open" | "all"
  skill?: CommunitySkillLevel
  doubles?: boolean
  following?: boolean
  usualTime?: UsualTimeKey
  cursor?: string
}

export type CommunityPlayerPage = {
  players: CommunityPlayer[]
  nextCursor: string | null
}

/** URL of a player's profile screen (app/(app)/community/player/[userId]). */
export function communityPlayerHref(userId: string) {
  return `/community/player/${encodeURIComponent(userId)}`
}

// --- Chat (M3) — mirrors src/server/community/chat-service.ts ---

export const QUICK_REPLIES = [
  "What time works for you?",
  "I'll book the table",
  "Running 10 min late",
  "Good game! 🏓",
] as const

export type ConversationFolder = "inbox" | "requests"
export type ConversationMemberState = "active" | "request" | "left"
export type CommunityMessageKind = "text" | "quick_reply" | "booking_card" | "kudos_prompt" | "system"

export type BookingCardPayload = {
  bookingId: string
  startsAt: string
  endsAt: string
  resourceName: string
  locationName: string
}

export type CommunityMessage = {
  id: string
  seq: number
  conversationId: string
  senderId: string | null
  mine: boolean
  kind: CommunityMessageKind
  body: string
  payload: BookingCardPayload | Record<string, unknown> | null
  clientMessageId: string | null
  createdAt: string
}

export type CommunityConversation = {
  id: string
  type: "direct" | "group" | "event"
  state: ConversationMemberState
  player: CommunityPlayer
  lastMessage: CommunityMessage | null
  unreadCount: number
  otherLastReadSeq: number
  canSend: boolean
  /** Set while the other player hasn't accepted your request yet. */
  pendingRequest: { remaining: number } | null
}

export type CommunityMessagesPage = {
  messages: CommunityMessage[]
  hasMore: boolean
  otherLastReadSeq: number
  conversation: CommunityConversation | null
}

export type CommunityUnreadCounts = { inbox: number; requests: number; groups?: number }

export type SendMessageInput =
  | { kind: "text" | "quick_reply"; body: string; clientMessageId: string }
  | { kind: "booking_card"; bookingId: string; clientMessageId: string }

export function communityChatHref(conversationId: string) {
  return `/community/chat/${encodeURIComponent(conversationId)}`
}

// --- Social loop (M4) — mirrors src/server/community/social-service.ts ---

export const KUDOS_TYPES = [
  "great_rallies",
  "fair_play",
  "on_time",
  "fun_to_play",
  "great_serve",
  "good_coach",
] as const

export type KudosType = (typeof KUDOS_TYPES)[number]
export type KudosCount = { type: KudosType; count: number }

export const KUDOS_LABELS: Record<KudosType, string> = {
  great_rallies: "Great rallies",
  fair_play: "Fair play",
  on_time: "On time",
  fun_to_play: "Fun to play",
  great_serve: "Great serve",
  good_coach: "Good coach",
}

export const KUDOS_EMOJI: Record<KudosType, string> = {
  great_rallies: "🏓",
  fair_play: "🤝",
  on_time: "⏱️",
  fun_to_play: "😄",
  great_serve: "🎯",
  good_coach: "🧠",
}

export const MAX_KUDOS_PER_MATCH = 3
export const PLAY_AGAIN_PREFILL = "Rematch? 🏓"

export type CommunitySharedBooking = {
  bookingId: string
  role: "owner" | "guest"
  hostId: string
  conversationId: string | null
  startsAt: string
  endsAt: string
  resourceName: string
  locationName: string
  phase: "upcoming" | "live" | "ended"
  kudosOpen: boolean
  partners: CommunityPlayer[]
  /** Kudos I already gave on this booking, by receiver id. */
  kudosGiven: Record<string, KudosType[]>
  /** Scoreboard match + who played which side (M5). */
  match?: CommunityBookingMatch | null
}

export type CommunityBookingMatch = {
  matchId: string
  status: string
  gamesA: number
  gamesB: number
  sideA: string | null
  sideB: string | null
  rated: boolean
}

export type CommunityAtVenue = {
  venue: CommunityVenueRef
  count: number
  players: CommunityPlayer[]
}

// --- Groups, scoreboard, invites (M5) ---

export type CommunityHeadToHead = {
  wins: number
  losses: number
  lastPlayedAt: string | null
  recent: { matchId: string; playedAt: string; myGames: number; theirGames: number; result: "win" | "loss" | "draw" }[]
}

export type CommunityGroupMember = CommunityPlayer & { groupRole?: "member" | "admin" }

export type CommunityGroup = {
  id: string
  type: "group" | "event"
  title: string
  description: string | null
  startsAt: string | null
  maxMembers: number | null
  memberCount: number
  members: CommunityGroupMember[]
  myRole: "member" | "admin"
  mutedUntil: string | null
  closed: boolean
  lastMessage: CommunityMessage | null
  unreadCount: number
}

export type CommunityGroupMessage = CommunityMessage & { senderName?: string | null }

export type CommunityGroupMessagesPage = {
  messages: CommunityGroupMessage[]
  hasMore: boolean
  group: CommunityGroup | null
}

export type CommunityEvent = {
  id: string
  title: string
  description: string | null
  startsAt: string | null
  maxMembers: number | null
  memberCount: number
  joined: boolean
}

export type CommunityInvite = { code: string; url: string }

export function communityGroupHref(groupId: string) {
  return `/community/group/${encodeURIComponent(groupId)}`
}

export const INVITE_SHARE_TEXT = "Play table tennis with me on PlayTT 🏓"
