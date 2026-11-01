// Pure M4 rules (docs/community/README.md): reliability, kudos and joining a
// shared booking. The services load the facts and apply these decisions.

import { KUDOS_BADGES, KUDOS_TYPES, SOCIAL_LIMITS, type KudosType } from "./constants.ts"

export type SharedBookingFact = {
  bookingId: string
  role: "owner" | "guest"
  bookingStatus: string
  startTime: Date
  endTime: Date
  cancelledAt: Date | null
  /** When this player pulled out of the booking (guests only). */
  leftAt: Date | null
  /** When the play session went active; null if it never did. */
  sessionStartedAt: Date | null
  excused: boolean
}

export type ReliabilityOutcome = "kept" | "missed" | "uncounted"

/**
 * One shared booking from this player's point of view.
 * - Pulling out (guest) or cancelling (owner) less than 2 h before the start
 *   is a miss; earlier than that it doesn't count either way.
 * - A guest isn't blamed when the host cancels.
 * - A booking that ended without the session ever going active is a no-show
 *   for everyone on it; ops can excuse it.
 * - Future bookings aren't counted yet.
 */
export function reliabilityOutcome(fact: SharedBookingFact, now: Date): ReliabilityOutcome {
  const lateCutoff = fact.startTime.getTime() - SOCIAL_LIMITS.lateWithdrawalMs

  if (fact.leftAt) {
    if (fact.leftAt.getTime() < lateCutoff) return "uncounted"
    return fact.excused ? "kept" : "missed"
  }

  if (fact.bookingStatus === "cancelled") {
    if (fact.role !== "owner") return "uncounted"
    if (!fact.cancelledAt || fact.cancelledAt.getTime() < lateCutoff) return "uncounted"
    return fact.excused ? "kept" : "missed"
  }

  if (fact.endTime > now) return "uncounted"
  if (fact.bookingStatus !== "confirmed" && fact.bookingStatus !== "completed") return "uncounted"

  if (!fact.sessionStartedAt) return fact.excused ? "kept" : "missed"
  return "kept"
}

export function computeReliability(facts: SharedBookingFact[], now: Date) {
  let kept = 0
  let total = 0

  for (const fact of facts) {
    const outcome = reliabilityOutcome(fact, now)
    if (outcome === "uncounted") continue
    total += 1
    if (outcome === "kept") kept += 1
  }

  const percent = total >= SOCIAL_LIMITS.reliabilityMinBookings ? Math.round((100 * kept) / total) : null
  const reliableBadge =
    percent !== null &&
    total >= SOCIAL_LIMITS.reliableBadgeMinBookings &&
    percent >= SOCIAL_LIMITS.reliableBadgePercent

  return { percent, kept, total, reliableBadge }
}

export type KudosCounts = Partial<Record<KudosType, number>>

export function kudosBadges(counts: KudosCounts) {
  return KUDOS_TYPES.filter((type) => (counts[type] ?? 0) >= SOCIAL_LIMITS.kudosBadgeThreshold).map(
    (type) => KUDOS_BADGES[type],
  )
}

export function topKudos(counts: KudosCounts, limit = 3) {
  return KUDOS_TYPES.map((type) => ({ type, count: counts[type] ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || KUDOS_TYPES.indexOf(a.type) - KUDOS_TYPES.indexOf(b.type))
    .slice(0, limit)
}

/** Kudos open when the session ends and close 72 h later. */
export function kudosWindow(endedAt: Date, now: Date): "not_yet" | "open" | "closed" {
  if (now < endedAt) return "not_yet"
  return now.getTime() - endedAt.getTime() <= SOCIAL_LIMITS.kudosWindowMs ? "open" : "closed"
}

export type JoinDecision =
  | { ok: true }
  | { ok: false; code: "BOOKING_NOT_JOINABLE" | "BOOKING_FULL"; reason: string }

/**
 * Joining a host's booking from a shared booking card. The booking's group
 * size is a hard cap, so nobody plays without the host paying for that seat.
 */
export function decideJoin(input: {
  bookingStatus: string
  startTime: Date
  groupSize: number
  activePartners: number
  alreadyJoined: boolean
  now: Date
}): JoinDecision {
  if (input.alreadyJoined) return { ok: true }

  if (input.bookingStatus !== "confirmed") {
    return { ok: false, code: "BOOKING_NOT_JOINABLE", reason: "This booking isn't confirmed." }
  }

  if (input.startTime <= input.now) {
    return { ok: false, code: "BOOKING_NOT_JOINABLE", reason: "This game has already started." }
  }

  // The host always occupies one seat, even before a partner row exists.
  const taken = Math.max(input.activePartners, 1)
  if (taken >= input.groupSize) {
    return {
      ok: false,
      code: "BOOKING_FULL",
      reason:
        input.groupSize <= 1
          ? "This booking is for 1 player. Ask the host to change it to 2 players."
          : `This booking is full (${input.groupSize} players).`,
    }
  }

  return { ok: true }
}
