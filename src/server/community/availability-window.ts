import { COMMUNITY_LIMITS, type PlayAvailabilityWindow } from "./constants.ts"

export type AvailabilityRange = { startsAt: Date; endsAt: Date }

export type AvailabilityWindowResult =
  | { ok: true; range: AvailabilityRange }
  | { ok: false; code: "WINDOW_PASSED"; message: string }

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: number // 0 = Sunday
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  )

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  }
}

// Converts a wall-clock time in `timeZone` to a UTC instant. Day overflow
// (e.g. day 32) is normalised by Date.UTC.
function zonedWallTimeToUtc(
  timeZone: string,
  wall: { year: number; month: number; day: number; hour: number; minute?: number },
) {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute ?? 0)
  const asZoned = zonedParts(new Date(guess), timeZone)
  const zonedAsUtc = Date.UTC(
    asZoned.year,
    asZoned.month - 1,
    asZoned.day,
    asZoned.hour,
    asZoned.minute,
    asZoned.second,
  )
  return new Date(guess - (zonedAsUtc - guess))
}

function endOfLocalDay(timeZone: string, local: ZonedParts, addDays = 0) {
  const nextMidnight = zonedWallTimeToUtc(timeZone, {
    year: local.year,
    month: local.month,
    day: local.day + addDays + 1,
    hour: 0,
  })
  return new Date(nextMidnight.getTime() - 1)
}

export function resolveAvailabilityWindow(
  window: PlayAvailabilityWindow,
  now: Date,
  timeZone: string,
): AvailabilityWindowResult {
  const local = zonedParts(now, timeZone)

  switch (window) {
    case "now":
      return {
        ok: true,
        range: {
          startsAt: now,
          endsAt: new Date(now.getTime() + COMMUNITY_LIMITS.nowWindowMinutes * 60_000),
        },
      }
    case "today":
      return { ok: true, range: { startsAt: now, endsAt: endOfLocalDay(timeZone, local) } }
    case "tonight": {
      const at = (hour: number) =>
        zonedWallTimeToUtc(timeZone, {
          year: local.year,
          month: local.month,
          day: local.day,
          hour,
        })
      const start = at(COMMUNITY_LIMITS.tonightStartHour)
      const end = at(COMMUNITY_LIMITS.tonightEndHour)

      if (now >= end) {
        return {
          ok: false,
          code: "WINDOW_PASSED",
          message: "Tonight's window has ended. Choose Now instead.",
        }
      }

      return { ok: true, range: { startsAt: now > start ? now : start, endsAt: end } }
    }
    case "weekend": {
      // Saturday = 6, Sunday = 0.
      const daysUntilSaturday = local.weekday === 0 ? 0 : 6 - local.weekday
      const isWeekend = local.weekday === 0 || local.weekday === 6
      const startsAt = isWeekend
        ? now
        : zonedWallTimeToUtc(timeZone, {
            year: local.year,
            month: local.month,
            day: local.day + daysUntilSaturday,
            hour: 0,
          })
      const daysUntilSunday = local.weekday === 0 ? 0 : 7 - local.weekday

      return {
        ok: true,
        range: { startsAt, endsAt: endOfLocalDay(timeZone, local, daysUntilSunday) },
      }
    }
  }
}

export function isOpenNow(range: AvailabilityRange, now: Date) {
  return range.startsAt <= now && now < range.endsAt
}
