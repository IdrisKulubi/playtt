// Pure scheduling helpers shared by availability, quotes, booking creation and
// edits. No database access here so the rules stay easy to test.

import {
  BOOKING_DURATION_OPTIONS,
  BOOKING_START_GRACE_MS,
  BOOKING_START_STEP_MINUTES,
} from "./constants.ts"

const MINUTE_MS = 60 * 1000

function toMs(value) {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "number") return value
  return new Date(value).getTime()
}

/** Rounds up to the next start step (5 minutes). Already on a step stays put. */
export function ceilToStartStep(value, stepMinutes = BOOKING_START_STEP_MINUTES) {
  const stepMs = stepMinutes * MINUTE_MS
  return new Date(Math.ceil(toMs(value) / stepMs) * stepMs)
}

export function floorToStartStep(value, stepMinutes = BOOKING_START_STEP_MINUTES) {
  const stepMs = stepMinutes * MINUTE_MS
  return new Date(Math.floor(toMs(value) / stepMs) * stepMs)
}

export function isOnStartStep(value, stepMinutes = BOOKING_START_STEP_MINUTES) {
  const ms = toMs(value)
  return ms % (stepMinutes * MINUTE_MS) === 0
}

/**
 * A start is in the past once it is more than a minute behind now. The minute
 * of grace covers the trip from the phone to the server, so "book now" works.
 */
export function isStartInPast(start, now = Date.now()) {
  return toMs(now) > toMs(start) + BOOKING_START_GRACE_MS
}

/** The soonest start someone can pick right now (next 5-minute step). */
export function earliestBookableStart(now = Date.now()) {
  return ceilToStartStep(toMs(now) - BOOKING_START_GRACE_MS)
}

export function isAllowedDuration(minutes) {
  return BOOKING_DURATION_OPTIONS.includes(minutes)
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart
}

/** Bookings on one table that overlap [start, end), as ms ranges. */
function busyFor(resourceId, bookings) {
  return bookings
    .filter((booking) => booking.resourceId === resourceId)
    .map((booking) => ({ start: toMs(booking.startTime), end: toMs(booking.endTime) }))
    .sort((a, b) => a.start - b.start)
}

/** Free gaps on one table between rangeStart and rangeEnd. */
export function freeWindows(busy, rangeStart, rangeEnd) {
  const windows = []
  let cursor = rangeStart
  for (const block of busy) {
    if (block.end <= cursor) continue
    if (block.start >= rangeEnd) break
    if (block.start > cursor) windows.push({ start: cursor, end: Math.min(block.start, rangeEnd) })
    cursor = Math.max(cursor, block.end)
    if (cursor >= rangeEnd) break
  }
  if (cursor < rangeEnd) windows.push({ start: cursor, end: rangeEnd })
  return windows
}

export function freeResourceIds({ resourceIds, bookings, start, end }) {
  const startMs = toMs(start)
  const endMs = toMs(end)
  return resourceIds.filter(
    (resourceId) =>
      !bookings.some(
        (booking) =>
          booking.resourceId === resourceId &&
          overlaps(toMs(booking.startTime), toMs(booking.endTime), startMs, endMs),
      ),
  )
}

/**
 * Checks a requested time and, when it clashes, finds the closest times that
 * work: the same start for a shorter game, the next start after, and the last
 * start before. Times only move in 5-minute steps and never into the past.
 *
 * Returns { status: "available", resourceId } or
 * { status: "conflict", conflicts, suggestions }.
 */
export function planBooking({
  resourceIds,
  bookings,
  start,
  durationMinutes,
  now = Date.now(),
  searchStart,
  searchEnd,
  maxSuggestions = 3,
}) {
  const startMs = toMs(start)
  const lengthMs = durationMinutes * MINUTE_MS
  const endMs = startMs + lengthMs
  const stepMs = BOOKING_START_STEP_MINUTES * MINUTE_MS

  const free = freeResourceIds({ resourceIds, bookings, start: startMs, end: endMs })
  if (free.length > 0) {
    return { status: "available", resourceId: free[0], resourceIds: free }
  }

  const conflicts = bookings
    .filter((booking) => overlaps(toMs(booking.startTime), toMs(booking.endTime), startMs, endMs))
    .map((booking) => ({
      resourceId: booking.resourceId,
      startsAt: new Date(toMs(booking.startTime)),
      endsAt: new Date(toMs(booking.endTime)),
    }))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())

  const floor = Math.max(toMs(earliestBookableStart(now)), toMs(searchStart))
  const latestStart = toMs(searchEnd)
  // Games may run past the end of the day (an 11:30 PM start), same as the grid.
  const windowEnd = latestStart + Math.max(...BOOKING_DURATION_OPTIONS) * MINUTE_MS

  const candidates = []

  for (const resourceId of resourceIds) {
    const windows = freeWindows(busyFor(resourceId, bookings), floor, windowEnd)

    // Next start at or after the requested one where the full game fits.
    for (const window of windows) {
      const candidateStart = Math.ceil(Math.max(window.start, startMs) / stepMs) * stepMs
      if (candidateStart >= latestStart) break
      if (candidateStart + lengthMs <= window.end) {
        candidates.push({ kind: "later", resourceId, start: candidateStart, minutes: durationMinutes })
        break
      }
    }

    // Last start before the requested one where the full game fits.
    for (let i = windows.length - 1; i >= 0; i -= 1) {
      const window = windows[i]
      const latestFit = Math.floor((Math.min(window.end, endMs) - lengthMs) / stepMs) * stepMs
      if (latestFit >= startMs) continue
      if (latestFit >= window.start && latestFit >= floor) {
        candidates.push({ kind: "earlier", resourceId, start: latestFit, minutes: durationMinutes })
        break
      }
    }

    // Same start, a shorter game that ends before the next group arrives.
    const startWindow = windows.find((window) => window.start <= startMs && window.end > startMs)
    if (startWindow && startMs >= floor) {
      const room = (startWindow.end - startMs) / MINUTE_MS
      const shorter = BOOKING_DURATION_OPTIONS.filter((option) => option < durationMinutes && option <= room)
      const best = shorter.at(-1)
      if (best) candidates.push({ kind: "shorter", resourceId, start: startMs, minutes: best })
    }
  }

  // Closest to what was asked first. A shorter game costs the minutes lost.
  const cost = (candidate) =>
    candidate.kind === "shorter"
      ? durationMinutes - candidate.minutes
      : Math.abs(candidate.start - startMs) / MINUTE_MS

  const seen = new Set()
  const suggestions = []
  for (const candidate of candidates.sort((a, b) => cost(a) - cost(b))) {
    const key = `${candidate.start}|${candidate.minutes}`
    if (seen.has(key)) continue
    seen.add(key)
    suggestions.push({
      kind: candidate.kind,
      resourceId: candidate.resourceId,
      startsAt: new Date(candidate.start),
      endsAt: new Date(candidate.start + candidate.minutes * MINUTE_MS),
      durationMinutes: candidate.minutes,
      shiftMinutes: Math.round((candidate.start - startMs) / MINUTE_MS),
    })
    if (suggestions.length >= maxSuggestions) break
  }

  return { status: "conflict", conflicts, suggestions }
}
