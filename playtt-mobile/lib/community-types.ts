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
}

export type CommunityRelationship = {
  following: boolean
  followsYou: boolean
  rallyPartner: boolean
  blockedByYou: boolean
  canMessage: boolean
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
}

export type CommunityVenueRef = { id: string; name: string }
export type CommunityCounts = { followers: number; following: number }

export type CommunityPlayerDetail = CommunityPlayer & {
  homeVenue: CommunityVenueRef | null
  counts: CommunityCounts
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
  cursor?: string
}

export type CommunityPlayerPage = {
  players: CommunityPlayer[]
  nextCursor: string | null
}
