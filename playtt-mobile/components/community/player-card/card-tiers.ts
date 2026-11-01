// Tier tokens and pure formatters for the player card (docs/community/player-card.md).

import type { AppColorScheme } from "@/constants/theme"
import type {
  CommunityAvailability,
  CommunityCardStats,
  CommunityCardTier,
  CommunityHandedness,
  CommunityPlayStyle,
  CommunityRelationship,
  CommunitySkillLevel,
  CommunityHeadToHead,
  CommunityVenueRef,
  KudosCount,
  UsualTimeKey,
} from "@/lib/community-types"

export type CardTier = CommunityCardTier
export type CardSize = "full" | "compact" | "mini"
export type CardVariant = "in_form" | "streak" | "founding" | "rally" | null

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
  /** Viewer vs. this player on the scoreboard (M5), for the card back. */
  headToHead?: CommunityHeadToHead | null
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
const LIGHT_TEXT = "#0a1628"

/** Server tier order, lowest first (src/server/community/card-points.ts). */
export const CARD_TIER_ORDER: CardTier[] = ["blue", "purple", "pink", "gold"]

export const CARD_TIERS: Record<CardTier, Record<AppColorScheme, CardTierTokens>> = {
  blue: {
    dark: {
      name: "Rookie",
      gradient: ["#0b3a78", "#061a3a"],
      accent: "#4fb4ff",
      borderEnd: "#1f6fd1",
      borderWidth: 1.5,
      borderOpacity: 1,
      text: DARK_TEXT,
      muted: "rgba(214, 234, 255, 0.66)",
      plate: "rgba(79, 180, 255, 0.14)",
      foilOpacity: 0.08,
    },
    light: {
      name: "Rookie",
      gradient: ["#e3f0ff", "#c6defc"],
      accent: "#0b5cad",
      borderEnd: "#4fb4ff",
      borderWidth: 1.5,
      borderOpacity: 1,
      text: LIGHT_TEXT,
      muted: "#34557a",
      plate: "rgba(11, 92, 173, 0.10)",
      foilOpacity: 0.04,
    },
  },
  purple: {
    dark: {
      name: "Contender",
      gradient: ["#3d1878", "#160833"],
      accent: "#b98cff",
      borderEnd: "#7a3df0",
      borderWidth: 1.5,
      borderOpacity: 1,
      text: DARK_TEXT,
      muted: "rgba(232, 220, 255, 0.68)",
      plate: "rgba(185, 140, 255, 0.16)",
      foilOpacity: 0.14,
    },
    light: {
      name: "Contender",
      gradient: ["#f1e8ff", "#dccbfb"],
      accent: "#5b2bb5",
      borderEnd: "#b98cff",
      borderWidth: 1.5,
      borderOpacity: 1,
      text: LIGHT_TEXT,
      muted: "#4f3a78",
      plate: "rgba(91, 43, 181, 0.10)",
      foilOpacity: 0.07,
    },
  },
  pink: {
    dark: {
      name: "Star",
      gradient: ["#7a1650", "#2e0620"],
      accent: "#ff7ac8",
      borderEnd: "#e0338f",
      borderWidth: 2,
      borderOpacity: 1,
      text: DARK_TEXT,
      muted: "rgba(255, 222, 240, 0.70)",
      plate: "rgba(255, 122, 200, 0.16)",
      foilOpacity: 0.18,
    },
    light: {
      name: "Star",
      gradient: ["#ffe6f3", "#fbc8e2"],
      accent: "#a3195f",
      borderEnd: "#ff7ac8",
      borderWidth: 2,
      borderOpacity: 1,
      text: LIGHT_TEXT,
      muted: "#7a2d55",
      plate: "rgba(163, 25, 95, 0.10)",
      foilOpacity: 0.09,
    },
  },
  gold: {
    dark: {
      name: "Legend",
      gradient: ["#5a4210", "#1c1404"],
      accent: "#f5c84c",
      borderEnd: "#b8892a",
      borderWidth: 2.5,
      borderOpacity: 1,
      text: DARK_TEXT,
      muted: "rgba(255, 240, 205, 0.70)",
      plate: "rgba(245, 200, 76, 0.16)",
      foilOpacity: 0.24,
    },
    light: {
      name: "Legend",
      gradient: ["#fff4d6", "#f3dd9c"],
      accent: "#7a560a",
      borderEnd: "#f5c84c",
      borderWidth: 2.5,
      borderOpacity: 1,
      text: LIGHT_TEXT,
      muted: "#6b5520",
      plate: "rgba(122, 86, 10, 0.10)",
      foilOpacity: 0.12,
    },
  },
}

export const OPEN_NOW_GREEN = "#2ee87a"

/** Tier comes from the server (earned card points); players without loaded card data start at blue. */
export function tierForPlayer(player: Pick<PlayerCardData, "stats">): CardTier {
  return player.stats.tier ?? "blue"
}

export function cardTierTokensFor(player: Pick<PlayerCardData, "stats">, scheme: AppColorScheme) {
  return CARD_TIERS[tierForPlayer(player)][scheme]
}

export function ratingLabel(player: Pick<PlayerCardData, "stats">) {
  const rating = player.stats.rating
  return rating === null || rating === undefined ? "NEW" : String(rating)
}

/** "320 pts to Star" plus a 0–1 fill for the progress bar; null at gold or when unknown. */
export function nextTierProgress(player: Pick<PlayerCardData, "stats">, scheme: AppColorScheme) {
  const { points, nextTierPoints } = player.stats
  if (points === null || points === undefined || !nextTierPoints) return null
  const next = CARD_TIER_ORDER[CARD_TIER_ORDER.indexOf(tierForPlayer(player)) + 1]
  if (!next) return null
  return {
    label: `${Math.max(0, nextTierPoints - points)} pts to ${CARD_TIERS[next][scheme].name}`,
    fraction: Math.min(1, Math.max(0, points / nextTierPoints)),
  }
}

export const IN_FORM_ORANGE = "#ff7a1a"

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

/** Numeric stats shown in the grid (tier is a label, not a stat). */
export type StatKey = Exclude<keyof CommunityCardStats, "tier">

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
  /** "2v2", "2v2 · 3/4" or "2v2 · full" (M5). */
  doublesLabel: string
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
  const fill = availability.doubles
  const doublesLabel = !fill || fill.members <= 1
    ? "2v2"
    : fill.members >= fill.max
      ? "2v2 · full"
      : `2v2 · ${fill.members}/${fill.max}`

  if (availability.openNow) {
    const until = formatNairobiClock(availability.endsAt)
    return {
      kind: "now",
      label: `OPEN NOW · →${until}`,
      spoken: `open now until ${until.replace("AM", " AM").replace("PM", " PM")}`,
      doubles,
      doublesLabel,
    }
  }

  const label = LATER_LABELS[availability.window]
  return { kind: "later", label, spoken: `open ${label.toLowerCase()}`, doubles, doublesLabel }
}

/** One variant at a time, in the priority order from the spec. */
export function cardVariant(player: PlayerCardData): CardVariant {
  if (player.badges?.includes("in_form")) return "in_form"
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
  const tier = CARD_TIERS[tierForPlayer(player)].dark.name
  const rating = player.stats.rating
  const parts = [`${player.displayName}, ${tier} tier`]
  if (rating !== null && rating !== undefined) parts.push(`rated ${rating}`)
  const ribbon = statusRibbon(player.availability)

  if (ribbon) {
    parts.push(ribbon.spoken)
    if (ribbon.doubles) parts.push(ribbon.doublesLabel === "2v2 · full" ? "doubles full" : "looking for doubles")
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
  in_form: "In form",
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

/** "You 2 – 3 Amara K." for the card back and chat header. */
export function headToHeadLine(h2h: CommunityHeadToHead | null | undefined, otherName: string) {
  if (!h2h || h2h.wins + h2h.losses === 0) return null
  return `You ${h2h.wins} – ${h2h.losses} ${otherName}`
}
