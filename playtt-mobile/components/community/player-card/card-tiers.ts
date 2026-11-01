// Tier tokens and pure formatters for the player card (docs/community/player-card.md).

import type { AppColorScheme } from "@/constants/theme"
import type {
  CommunityAvailability,
  CommunityCardStats,
  CommunityHandedness,
  CommunityPlayStyle,
  CommunityRelationship,
  CommunitySkillLevel,
  CommunityVenueRef,
  KudosCount,
  UsualTimeKey,
} from "@/lib/community-types"

export type CardTier = "rookie" | "club" | "elite"
export type CardSize = "full" | "compact" | "mini"
export type CardVariant = "streak" | "founding" | "rally" | null

/** What the card needs; both CommunityPlayer and CommunityMe map onto it. */
export type PlayerCardData = {
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
  stats: CommunityCardStats
  relationship?: CommunityRelationship
  homeVenue?: CommunityVenueRef | null
  /** Server-earned badges ("rally_ace", "reliable", …). */
  badges?: string[]
  /** Top kudos received, shown on the card back. */
  kudos?: KudosCount[]
  /** Set when the player is at a venue right now (M4 strip). */
  atVenueName?: string | null
}

export type CardTierTokens = {
  name: string
  gradient: [string, string]
  accent: string
  /** Second stop for the border gradient (same as accent for flat borders). */
  borderEnd: string
  borderWidth: number
  borderOpacity: number
  text: string
  muted: string
  plate: string
  foilOpacity: number
}

const DARK_TEXT = "#ffffff"
const DARK_MUTED = "rgba(255, 255, 255, 0.62)"
const LIGHT_TEXT = "#0a1628"
const LIGHT_MUTED = "#4a5a70"

export const CARD_TIERS: Record<CardTier, Record<AppColorScheme, CardTierTokens>> = {
  rookie: {
    dark: {
      name: "Rookie",
      gradient: ["#1a2230", "#0e141d"],
      accent: "#5fd4ff",
      borderEnd: "#5fd4ff",
      borderWidth: 1,
      borderOpacity: 0.4,
      text: DARK_TEXT,
      muted: DARK_MUTED,
      plate: "rgba(95, 212, 255, 0.10)",
      foilOpacity: 0,
    },
    light: {
      name: "Rookie",
      gradient: ["#eef3f8", "#dfe7f0"],
      accent: "#0077a8",
      borderEnd: "#0077a8",
      borderWidth: 1,
      borderOpacity: 0.4,
      text: LIGHT_TEXT,
      muted: LIGHT_MUTED,
      plate: "rgba(0, 119, 168, 0.08)",
      foilOpacity: 0,
    },
  },
  club: {
    dark: {
      name: "Club",
      gradient: ["#0a3d6b", "#06182b"],
      accent: "#00b7ff",
      borderEnd: "#00b7ff",
      borderWidth: 1.5,
      borderOpacity: 1,
      text: DARK_TEXT,
      muted: DARK_MUTED,
      plate: "rgba(0, 183, 255, 0.14)",
      foilOpacity: 0.16,
    },
    light: {
      name: "Club",
      gradient: ["#e2f4ff", "#c8e9fb"],
      accent: "#006a99",
      borderEnd: "#00b7ff",
      borderWidth: 1.5,
      borderOpacity: 1,
      text: LIGHT_TEXT,
      muted: LIGHT_MUTED,
      plate: "rgba(0, 106, 153, 0.10)",
      foilOpacity: 0.08,
    },
  },
  elite: {
    dark: {
      name: "Elite",
      gradient: ["#22232b", "#0b0b10"],
      accent: "#f5c84c",
      borderEnd: "#b8892a",
      borderWidth: 2,
      borderOpacity: 1,
      text: DARK_TEXT,
      muted: "rgba(255, 240, 205, 0.68)",
      plate: "rgba(245, 200, 76, 0.14)",
      foilOpacity: 0.2,
    },
    light: {
      name: "Elite",
      gradient: ["#fff7e0", "#f6e6b8"],
      accent: "#8a6410",
      borderEnd: "#f5c84c",
      borderWidth: 2,
      borderOpacity: 1,
      text: LIGHT_TEXT,
      muted: "#6b5520",
      plate: "rgba(138, 100, 16, 0.10)",
      foilOpacity: 0.1,
    },
  },
}

export const OPEN_NOW_GREEN = "#2ee87a"

export function tierForSkill(skill: CommunitySkillLevel): CardTier {
  if (skill === "pro") return "elite"
  if (skill === "intermediate") return "club"
  return "rookie"
}

export function cardTierTokens(skill: CommunitySkillLevel, scheme: AppColorScheme) {
  return CARD_TIERS[tierForSkill(skill)][scheme]
}

const PLAY_STYLE_CODES: Record<CommunityPlayStyle, string> = {
  attacker: "ATK",
  defender: "DEF",
  all_round: "ALL",
}

const PLAY_STYLE_NAMES: Record<CommunityPlayStyle, string> = {
  attacker: "Attacker",
  defender: "Defender",
  all_round: "All-round",
}

export function playStyleCode(style: CommunityPlayStyle | null) {
  return style ? PLAY_STYLE_CODES[style] : null
}

export function playStyleName(style: CommunityPlayStyle) {
  return PLAY_STYLE_NAMES[style]
}

export function handednessCode(handedness: CommunityHandedness | null) {
  if (!handedness) return null
  return handedness === "left" ? "L" : "R"
}

export const USUAL_TIME_LABELS: Record<UsualTimeKey, string> = {
  weekday_mornings: "Weekday mornings",
  weekday_lunch: "Weekday lunch",
  weekday_evenings: "Weekday evenings",
  sat_mornings: "Sat mornings",
  sat_afternoons: "Sat afternoons",
  sun_mornings: "Sun mornings",
  sun_afternoons: "Sun afternoons",
  late_night: "Late night",
}

export type StatKey = keyof CommunityCardStats

export type StatSlot = { key: StatKey; code: string; spoken: string; percent?: boolean }

export const STAT_SLOTS: StatSlot[] = [
  { key: "matches", code: "MAT", spoken: "matches" },
  { key: "winRate", code: "WIN%", spoken: "percent wins", percent: true },
  { key: "reliability", code: "REL", spoken: "percent reliability", percent: true },
  { key: "streakWeeks", code: "STK", spoken: "week streak" },
  { key: "kudos", code: "KUD", spoken: "kudos" },
  { key: "hours", code: "HRS", spoken: "hours played" },
]

export const COMPACT_STAT_KEYS: StatKey[] = ["matches", "winRate", "reliability"]

export const EMPTY_STAT = "—"

export function formatStat(value: number | null | undefined) {
  return value === null || value === undefined ? EMPTY_STAT : String(Math.round(value))
}

// Nairobi is UTC+3 with no DST; Hermes Intl time zone support varies, so
// format with a fixed offset like the server does.
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000

export function formatNairobiClock(iso: string) {
  const local = new Date(new Date(iso).getTime() + NAIROBI_OFFSET_MS)
  const hours24 = local.getUTCHours()
  const minutes = local.getUTCMinutes()
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12
  const suffix = hours24 < 12 ? "AM" : "PM"
  return minutes === 0 ? `${hours}${suffix}` : `${hours}:${String(minutes).padStart(2, "0")}${suffix}`
}

export type StatusRibbon = {
  kind: "now" | "later"
  label: string
  spoken: string
  doubles: boolean
}

const LATER_LABELS = {
  now: "LATER",
  today: "TODAY",
  tonight: "TONIGHT",
  weekend: "WEEKEND",
} as const

export function statusRibbon(availability: CommunityAvailability | null): StatusRibbon | null {
  if (!availability) return null
  const doubles = availability.lookingForDoubles

  if (availability.openNow) {
    const until = formatNairobiClock(availability.endsAt)
    return {
      kind: "now",
      label: `OPEN NOW · →${until}`,
      spoken: `open now until ${until.replace("AM", " AM").replace("PM", " PM")}`,
      doubles,
    }
  }

  const label = LATER_LABELS[availability.window]
  return { kind: "later", label, spoken: `open ${label.toLowerCase()}`, doubles }
}

/** One variant at a time, in the priority order from the spec. */
export function cardVariant(player: PlayerCardData): CardVariant {
  if ((player.stats.streakWeeks ?? 0) >= 4) return "streak"
  if (player.foundingPlayer) return "founding"
  if (player.relationship?.rallyPartner) return "rally"
  return null
}

export function cardInitials(displayName: string) {
  const letters = displayName
    .replace(/\./g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
  return letters.slice(0, 2) || "P"
}

export function playerCardAccessibilityLabel(player: PlayerCardData) {
  const tier = CARD_TIERS[tierForSkill(player.skillLevel)].dark.name
  const parts = [`${player.displayName}, ${tier} tier`]
  const ribbon = statusRibbon(player.availability)

  if (ribbon) {
    parts.push(ribbon.spoken)
    if (ribbon.doubles) parts.push("looking for doubles")
  }

  if (player.atVenueName) {
    parts.push(`at ${player.atVenueName} now`)
  }

  if (player.relationship?.rallyPartner) {
    parts.push("rally partner")
  }

  for (const slot of STAT_SLOTS.filter((s) => COMPACT_STAT_KEYS.includes(s.key))) {
    const value = player.stats[slot.key]
    if (value !== null && value !== undefined) {
      parts.push(`${Math.round(value)} ${slot.spoken}`)
    }
  }

  return parts.join(", ")
}

export function cardDataFromMe(me: {
  id: string
  displayName: string
  image: string | null
  skillLevel: CommunitySkillLevel
  profile: {
    playStyle: CommunityPlayStyle | null
    handedness: CommunityHandedness | null
    bio: string | null
    usualTimes: UsualTimeKey[]
    foundingPlayer: boolean
  }
  availability: CommunityAvailability | null
  stats: CommunityCardStats
  homeVenue: CommunityVenueRef | null
  badges?: string[]
  kudos?: KudosCount[]
}): PlayerCardData {
  return {
    id: me.id,
    displayName: me.displayName,
    image: me.image,
    skillLevel: me.skillLevel,
    playStyle: me.profile.playStyle,
    handedness: me.profile.handedness,
    bio: me.profile.bio,
    usualTimes: me.profile.usualTimes,
    foundingPlayer: me.profile.foundingPlayer,
    availability: me.availability,
    stats: me.stats,
    homeVenue: me.homeVenue,
    badges: me.badges,
    kudos: me.kudos,
  }
}

/** Labels for server badge keys (src/server/community/constants.ts KUDOS_BADGES). */
export const BADGE_LABELS: Record<string, string> = {
  rally_ace: "Rally ace",
  fair_play: "Fair play",
  clockwork: "Clockwork",
  good_vibes: "Good vibes",
  ace_server: "Ace server",
  mentor: "Mentor",
  reliable: "Reliable",
}

/** Usual times both players share, for the "Also free on…" hint. */
export function sharedUsualTimes(mine: UsualTimeKey[], theirs: UsualTimeKey[]) {
  return theirs.filter((key) => mine.includes(key))
}
