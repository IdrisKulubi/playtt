import { addMinutes } from "date-fns"

import {
  BOOKING_SLOT_INTERVAL_MINUTES,
  DEFAULT_VENUE_TIMEZONE,
} from "./constants.ts"

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const WEEKDAY_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

function pad2(value) {
  return String(value).padStart(2, "0")
}

function zonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })

  const parts = {}
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      parts[part.type] = part.value
    }
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday,
  }
}

function zonedOffsetMs(date, timeZone) {
  const parts = zonedParts(date, timeZone)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return asUtc - date.getTime()
}

function addCalendarDay(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`
}

export function zonedWallTime(
  dateKey,
  hour,
  minute,
  timeZone = DEFAULT_VENUE_TIMEZONE,
) {
  const utcGuess = new Date(
    `${dateKey}T${pad2(hour)}:${pad2(minute)}:00.000Z`,
  )
  const offset = zonedOffsetMs(utcGuess, timeZone)
  const shifted = new Date(utcGuess.getTime() - offset)
  const adjustedOffset = zonedOffsetMs(shifted, timeZone)

  if (adjustedOffset === offset) {
    return shifted
  }

  return new Date(utcGuess.getTime() - adjustedOffset)
}

export function getZonedHours(date, timeZone = DEFAULT_VENUE_TIMEZONE) {
  return zonedParts(date, timeZone).hour
}

export function getZonedDay(date, timeZone = DEFAULT_VENUE_TIMEZONE) {
  const weekday = zonedParts(date, timeZone).weekday
  return WEEKDAY_INDEX[weekday] ?? 0
}

export function sameBookingDay(date, timeZone = DEFAULT_VENUE_TIMEZONE) {
  const parts = zonedParts(date, timeZone)
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`
}

export function buildDaySlots(
  date,
  durationMinutes,
  timeZone = DEFAULT_VENUE_TIMEZONE,
) {
  const dateKey =
    typeof date === "string" && DATE_KEY_PATTERN.test(date)
      ? date
      : sameBookingDay(
          typeof date === "string" ? new Date(date) : date,
          timeZone,
        )

  const dayStart = zonedWallTime(dateKey, 0, 0, timeZone)
  const dayEnd = zonedWallTime(addCalendarDay(dateKey), 0, 0, timeZone)
  const slots = []
  let current = dayStart

  while (current.getTime() < dayEnd.getTime()) {
    slots.push({
      startsAt: current,
      endsAt: addMinutes(current, durationMinutes),
    })
    current = addMinutes(current, BOOKING_SLOT_INTERVAL_MINUTES)
  }

  return slots
}

export function isSlotClosedForBooking(startsAt, now = new Date()) {
  const startMs =
    startsAt instanceof Date ? startsAt.getTime() : new Date(startsAt).getTime()
  const nowMs = now instanceof Date ? now.getTime() : Number(now)

  return nowMs >= startMs + BOOKING_SLOT_INTERVAL_MINUTES * 60 * 1000
}
