export const PLAY_SESSION_STATUSES = [
  "held",
  "confirmed",
  "preparing",
  "active",
  "ending",
  "completed",
  "resetting",
  "available",
]

/** @type {Record<string, string[]>} */
const LEGAL_TRANSITIONS = {
  held: ["confirmed", "available"],
  confirmed: ["preparing", "available"],
  preparing: ["active", "available"],
  active: ["ending", "completed"],
  ending: ["completed"],
  completed: ["resetting"],
  resetting: ["available"],
  available: [],
}

/**
 * @param {string} fromStatus
 * @param {string} toStatus
 */
export function canTransitionPlaySession(fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    return { ok: true, idempotent: true }
  }

  const allowed = LEGAL_TRANSITIONS[fromStatus] ?? []

  if (allowed.includes(toStatus)) {
    return { ok: true, idempotent: false }
  }

  return { ok: false, code: "ILLEGAL_SESSION_TRANSITION" }
}

/**
 * @param {string} bookingStatus
 */
export function initialPlaySessionStatusForBooking(bookingStatus) {
  if (bookingStatus === "completed") {
    return "completed"
  }

  if (bookingStatus === "confirmed") {
    return "confirmed"
  }

  return null
}

/**
 * @param {{ status: string, paymentStatus: string }} booking
 */
export function shouldCreatePlaySessionForBooking(booking) {
  if (booking.paymentStatus !== "paid") {
    return false
  }

  return booking.status === "confirmed" || booking.status === "completed"
}

/**
 * @param {string} toStatus
 * @param {Date} at
 */
export function playSessionTimestampUpdatesForTransition(toStatus, at) {
  switch (toStatus) {
    case "preparing":
      return { preparedAt: at }
    case "active":
      return { startedAt: at }
    case "ending":
      return { endedAt: at }
    case "completed":
      return { completedAt: at }
    case "available":
      return { resetAt: at }
    default:
      return {}
  }
}
