// Card points, rating and tier ladder (docs/community/player-card.md).
// Everything here is earned from real PlayTT activity: scoreboard wins,
// sessions played, coach drills completed and kudos received.

export const CARD_POINT_VALUES = {
  win: 25,
  session: 10,
  drill: 15,
  kudos: 5,
} as const

export type CardTier = "blue" | "purple" | "pink" | "gold"

/** Ascending ladder; a player is in the highest tier whose `minPoints` they reach. */
export const CARD_TIER_LADDER: { tier: CardTier; name: string; minPoints: number }[] = [
  { tier: "blue", name: "Rookie", minPoints: 0 },
  { tier: "purple", name: "Contender", minPoints: 600 },
  { tier: "pink", name: "Star", minPoints: 1400 },
  { tier: "gold", name: "Legend", minPoints: 2500 },
]

const RATING_FLOOR = 40
const RATING_CEILING = 99
/** Points scale of the rating curve: early points move the number fast, 99 is a long climb. */
const RATING_SCALE = 1500

export type CardPointInputs = {
  wins: number
  sessions: number
  drills: number
  kudos: number
}

export function cardPoints(input: CardPointInputs) {
  return (
    input.wins * CARD_POINT_VALUES.win +
    input.sessions * CARD_POINT_VALUES.session +
    input.drills * CARD_POINT_VALUES.drill +
    input.kudos * CARD_POINT_VALUES.kudos
  )
}

/** Points → card number 40–99 on a diminishing curve. */
export function cardRatingFromPoints(points: number) {
  const span = RATING_CEILING - RATING_FLOOR
  const rating = RATING_FLOOR + span * (1 - Math.exp(-Math.max(points, 0) / RATING_SCALE))
  return Math.min(RATING_CEILING, Math.round(rating))
}

export function tierForPoints(points: number): CardTier {
  let current: CardTier = "blue"
  for (const step of CARD_TIER_LADDER) {
    if (points >= step.minPoints) current = step.tier
  }
  return current
}

/** Next tier and its threshold, or null at the top of the ladder. */
export function nextTierFor(points: number) {
  const next = CARD_TIER_LADDER.find((step) => step.minPoints > points)
  return next ? { tier: next.tier, minPoints: next.minPoints } : null
}

export function cardProgress(input: CardPointInputs) {
  const points = cardPoints(input)
  const next = nextTierFor(points)
  return {
    points,
    rating: cardRatingFromPoints(points),
    tier: tierForPoints(points),
    nextTier: next?.tier ?? null,
    nextTierPoints: next?.minPoints ?? null,
  }
}
