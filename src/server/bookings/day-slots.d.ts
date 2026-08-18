export function zonedWallTime(
  dateKey: string,
  hour: number,
  minute: number,
  timeZone?: string,
): Date

export function getZonedHours(date: Date, timeZone?: string): number

export function getZonedDay(date: Date, timeZone?: string): number

export function sameBookingDay(date: Date, timeZone?: string): string

export function buildDaySlots(
  date: Date | string,
  durationMinutes: number,
  timeZone?: string,
): { startsAt: Date; endsAt: Date }[]
