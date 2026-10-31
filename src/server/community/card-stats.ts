// Player card stats (docs/community/player-card.md). Pure so it can be tested
// without a database; the service feeds it per-week session totals.

export const CARD_STATS_TIME_ZONE = "Africa/Nairobi"

export type CardStatWeek = {
  userId: string
  /** Monday of the Nairobi week, YYYY-MM-DD. */
  weekStart: string
  sessions: number
  minutes: number
}

/** A null stat means "not enough data yet"; the card shows a dash. */
export type CardStats = {
  matches: number | null
  winRate: number | null
  reliability: number | null
  streakWeeks: number | null
  kudos: number | null
  hours: number | null
}

export const EMPTY_CARD_STATS: CardStats = {
  matches: null,
  winRate: null,
  reliability: null,
  streakWeeks: null,
  kudos: null,
  hours: null,
}

const DAY_MS = 86_400_000

function nairobiWeekStart(now: Date) {
  // Nairobi is UTC+3 with no DST, matching src/server/activity/aggregate.ts.
  const local = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const daysSinceMonday = (local.getUTCDay() + 6) % 7
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday),
  )
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

/**
 * Consecutive weeks with at least one session. The streak stays alive through
 * the current week until it ends, so it counts back from last week when this
 * week has no session yet.
 */
export function weeklyStreak(weekStarts: Iterable<string>, now: Date) {
  const weeks = new Set(weekStarts)
  let cursor = nairobiWeekStart(now)

  if (!weeks.has(isoDate(cursor))) {
    cursor = new Date(cursor.getTime() - 7 * DAY_MS)
  }

  let streak = 0
  while (weeks.has(isoDate(cursor))) {
    streak += 1
    cursor = new Date(cursor.getTime() - 7 * DAY_MS)
  }

  return streak
}

export function computeCardStats(weeks: CardStatWeek[], now: Date): CardStats {
  let sessions = 0
  let minutes = 0
  const active: string[] = []

  for (const week of weeks) {
    if (week.sessions <= 0) continue
    sessions += week.sessions
    minutes += week.minutes
    active.push(week.weekStart)
  }

  const streak = weeklyStreak(active, now)

  return {
    ...EMPTY_CARD_STATS,
    matches: sessions > 0 ? sessions : null,
    hours: minutes > 0 ? Math.max(1, Math.round(minutes / 60)) : null,
    streakWeeks: streak > 0 ? streak : null,
  }
}

export type CardStatSession = {
  userId: string
  bookingId: string
  startTime: Date
  durationMinutes: number
}

/**
 * Collapses played sessions into per-week totals. A player can appear as both
 * booking owner and session participant, so sessions are deduped per booking.
 */
export function toCardStatWeeks(sessions: CardStatSession[]): CardStatWeek[] {
  const seen = new Set<string>()
  const weeks = new Map<string, CardStatWeek>()

  for (const session of sessions) {
    const key = `${session.userId}:${session.bookingId}`
    if (seen.has(key)) continue
    seen.add(key)

    const weekStart = isoDate(nairobiWeekStart(session.startTime))
    const weekKey = `${session.userId}:${weekStart}`
    const week = weeks.get(weekKey) ?? { userId: session.userId, weekStart, sessions: 0, minutes: 0 }
    week.sessions += 1
    week.minutes += session.durationMinutes
    weeks.set(weekKey, week)
  }

  return [...weeks.values()]
}

export function groupCardStats(userIds: string[], weeks: CardStatWeek[], now: Date) {
  const byUser = new Map<string, CardStatWeek[]>()
  for (const week of weeks) {
    const list = byUser.get(week.userId) ?? []
    list.push(week)
    byUser.set(week.userId, list)
  }

  return new Map(userIds.map((id) => [id, computeCardStats(byUser.get(id) ?? [], now)]))
}
