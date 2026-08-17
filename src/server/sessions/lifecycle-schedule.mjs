export const PREPARE_LEAD_MS = 2 * 60 * 1000

export const LIFECYCLE_HAPPY_PATH = [
  "held",
  "confirmed",
  "preparing",
  "active",
  "ending",
  "completed",
  "resetting",
  "available",
]

/** @type {Record<string, { toStatus: string, eventType: string }>} */
export const NEXT_LIFECYCLE_STEP = {
  confirmed: { toStatus: "preparing", eventType: "session.preparing.v1" },
  preparing: { toStatus: "active", eventType: "session.started.v1" },
  active: { toStatus: "ending", eventType: "session.ending.v1" },
  ending: { toStatus: "completed", eventType: "session.completed.v1" },
  completed: { toStatus: "resetting", eventType: "session.resetting.v1" },
  resetting: { toStatus: "available", eventType: "session.resetting.v1" },
}

/**
 * @param {string} status
 */
export function isTerminalPlaySessionStatus(status) {
  return status === "available" || status === "held"
}

/**
 * @param {string} status
 */
export function happyPathIndex(status) {
  return LIFECYCLE_HAPPY_PATH.indexOf(status)
}

/**
 * True when current is the same as target or further along the happy path.
 * @param {string} currentStatus
 * @param {string} targetStatus
 */
export function isPlaySessionAtOrPastStatus(currentStatus, targetStatus) {
  const currentIndex = happyPathIndex(currentStatus)
  const targetIndex = happyPathIndex(targetStatus)

  if (currentIndex < 0 || targetIndex < 0) {
    return currentStatus === targetStatus
  }

  return currentIndex >= targetIndex
}

/**
 * @param {Date | string} start
 * @param {Date} now
 */
export function preparingAvailableAt(start, now = new Date()) {
  const startMs = new Date(start).getTime()
  const due = new Date(startMs - PREPARE_LEAD_MS)
  return due.getTime() <= now.getTime() ? now : due
}

/**
 * @param {Date | string} at
 * @param {Date} now
 */
export function dueOrNow(at, now = new Date()) {
  const due = new Date(at)
  return due.getTime() <= now.getTime() ? now : due
}

/**
 * Next durable lifecycle intent for a play session, or null when terminal.
 *
 * @param {{
 *   status: string,
 *   scheduledStartAt: Date | string,
 *   scheduledEndAt: Date | string,
 * }} session
 * @param {Date} [now]
 */
export function nextLifecycleIntent(session, now = new Date()) {
  if (isTerminalPlaySessionStatus(session.status)) {
    return null
  }

  const step = NEXT_LIFECYCLE_STEP[session.status]
  if (!step) {
    return null
  }

  let availableAt

  switch (session.status) {
    case "confirmed":
      availableAt = preparingAvailableAt(session.scheduledStartAt, now)
      break
    case "preparing":
      availableAt = dueOrNow(session.scheduledStartAt, now)
      break
    case "active":
      availableAt = dueOrNow(session.scheduledEndAt, now)
      break
    case "ending":
      availableAt = dueOrNow(session.scheduledEndAt, now)
      break
    default:
      availableAt = now
  }

  return {
    toStatus: step.toStatus,
    eventType: step.eventType,
    availableAt,
  }
}

export function sessionLifecycleIdempotencyKey(eventType, sessionId, toStatus) {
  return `${eventType}:${sessionId}:${toStatus}`
}
