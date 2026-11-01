// Pure rating, form and head-to-head rules (docs/community/README.md, M5).

export const RATING_RULES = {
  start: 1000,
  newPlayerK: 32,
  settledK: 16,
  newPlayerMatches: 10,
  /** The card shows a rating only after this many rated matches. */
  cardMinMatches: 5,
  /** WIN% shows after this many recorded matches. */
  winRateMinMatches: 5,
  inFormStreak: 3,
} as const

export function kFactor(ratedMatches: number) {
  return ratedMatches < RATING_RULES.newPlayerMatches ? RATING_RULES.newPlayerK : RATING_RULES.settledK
}

export function expectedScore(rating: number, opponent: number) {
  return 1 / (1 + 10 ** ((opponent - rating) / 400))
}

export type RatedPlayer = { rating: number; ratedMatches: number }

/**
 * Elo update for one 1v1 match. `scoreA` is 1 (A won), 0 (B won) or 0.5
 * (level). Each side uses its own K, so a new player moves faster than a
 * settled one.
 */
export function rateMatch(a: RatedPlayer, b: RatedPlayer, scoreA: 0 | 0.5 | 1) {
  const deltaA = Math.round(kFactor(a.ratedMatches) * (scoreA - expectedScore(a.rating, b.rating)))
  const deltaB = Math.round(kFactor(b.ratedMatches) * (1 - scoreA - expectedScore(b.rating, a.rating)))
  return {
    a: { rating: a.rating + deltaA, ratedMatches: a.ratedMatches + 1, delta: deltaA },
    b: { rating: b.rating + deltaB, ratedMatches: b.ratedMatches + 1, delta: deltaB },
  }
}

export function matchScore(gamesA: number, gamesB: number): 0 | 0.5 | 1 {
  if (gamesA === gamesB) return 0.5
  return gamesA > gamesB ? 1 : 0
}

/** Elo → card number: clamp(round(40 + (rating − 600) / 15), 40, 99). */
export function cardRating(rating: number) {
  return Math.min(99, Math.max(40, Math.round(40 + (rating - 600) / 15)))
}

export function cardRatingFor(player: RatedPlayer | null | undefined) {
  if (!player || player.ratedMatches < RATING_RULES.cardMinMatches) return null
  return cardRating(player.rating)
}

/** Once rated, the tier comes from the card rating instead of self-reported skill. */
export function tierFromCardRating(rating: number): "rookie" | "club" | "elite" {
  if (rating >= 80) return "elite"
  if (rating >= 60) return "club"
  return "rookie"
}

export type RecordedResult = { won: boolean | null; playedAt: Date }

/** WIN% over decided matches; null until enough are recorded. */
export function winRate(results: RecordedResult[]) {
  if (results.length < RATING_RULES.winRateMinMatches) return null
  const decided = results.filter((result) => result.won !== null)
  if (decided.length === 0) return null
  return Math.round((100 * decided.filter((result) => result.won).length) / decided.length)
}

/** "In form": won each of the last 3 recorded matches. */
export function isInForm(results: RecordedResult[]) {
  const recent = [...results].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime()).slice(0, RATING_RULES.inFormStreak)
  return recent.length === RATING_RULES.inFormStreak && recent.every((result) => result.won === true)
}

export type HeadToHeadMatch = {
  matchId: string
  playedAt: Date
  myGames: number
  theirGames: number
}

export function headToHead(matches: HeadToHeadMatch[], recentLimit = 5) {
  const sorted = [...matches].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
  return {
    wins: sorted.filter((match) => match.myGames > match.theirGames).length,
    losses: sorted.filter((match) => match.myGames < match.theirGames).length,
    lastPlayedAt: sorted[0]?.playedAt.toISOString() ?? null,
    recent: sorted.slice(0, recentLimit).map((match) => ({
      matchId: match.matchId,
      playedAt: match.playedAt.toISOString(),
      myGames: match.myGames,
      theirGames: match.theirGames,
      result: match.myGames === match.theirGames ? "draw" : match.myGames > match.theirGames ? "win" : "loss",
    })),
  }
}

// --- Invites ---

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I

export function generateInviteCode(random: (max: number) => number) {
  let code = ""
  for (let i = 0; i < 8; i += 1) code += INVITE_ALPHABET[random(INVITE_ALPHABET.length)]
  return code
}

export function normalizeInviteCode(input: string) {
  const code = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  return /^[A-HJ-NP-Z2-9]{8}$/.test(code) ? code : null
}

// --- Groups ---

export const GROUP_LIMITS = {
  doublesMaxMembers: 4,
  eventMaxMembersCap: 64,
  invitesPerDay: 20,
} as const

export type GroupJoinDecision = { ok: true } | { ok: false; reason: "FULL" | "CLOSED" }

export function decideGroupJoin(input: { activeMembers: number; maxMembers: number; alreadyMember: boolean; closed: boolean }): GroupJoinDecision {
  if (input.alreadyMember) return { ok: true }
  if (input.closed) return { ok: false, reason: "CLOSED" }
  if (input.activeMembers >= input.maxMembers) return { ok: false, reason: "FULL" }
  return { ok: true }
}
