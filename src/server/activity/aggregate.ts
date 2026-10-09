export type ActivityPeriod = "year" | "month" | "day"
export type ActivityRow = {
  id: string
  startTime: Date
  endTime: Date
  durationMinutes: number
  locationName: string
  resourceName: string
  status: string
  paymentStatus: string
  currency: string
  totalKes: number
  spendKes: number
}
const OFFSET = 3 * 60 * 60 * 1000
export function nairobiDate(value: Date) {
  return new Date(value.getTime() + OFFSET).toISOString().slice(0, 10)
}
export function activityRange(period: ActivityPeriod, date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date < "2000-01-01" ||
    date > "2100-12-31"
  )
    throw new Error("Invalid activity date")
  const day = new Date(`${date}T00:00:00Z`)
  if (
    !Number.isFinite(day.getTime()) ||
    day.toISOString().slice(0, 10) !== date
  )
    throw new Error("Invalid activity date")
  const year = day.getUTCFullYear(),
    month = day.getUTCMonth()
  const startWall =
    period === "year"
      ? Date.UTC(year, 0, 1)
      : period === "month"
        ? Date.UTC(year, month, 1)
        : day.getTime()
  const endWall =
    period === "year"
      ? Date.UTC(year + 1, 0, 1)
      : period === "month"
        ? Date.UTC(year, month + 1, 1)
        : startWall + 86400000
  const previousWall =
    period === "year"
      ? Date.UTC(year - 1, 0, 1)
      : period === "month"
        ? Date.UTC(year, month - 1, 1)
        : startWall - 86400000
  return {
    start: new Date(startWall - OFFSET),
    end: new Date(endWall - OFFSET),
    previousStart: new Date(previousWall - OFFSET),
  }
}
function emptyTotals() {
  return {
    sessions: 0,
    minutes: 0,
    spendKes: 0,
    completedSessions: 0,
    cancelledSessions: 0,
    bookings: 0,
    averageMinutes: 0,
    averageSpendKes: 0,
  }
}
function round(value: number) {
  return Math.round(value * 100) / 100
}
export function aggregateActivity(
  rows: ActivityRow[],
  period: ActivityPeriod,
  date: string,
  now = new Date()
) {
  const range = activityRange(period, date)
  function summarize(start: Date, end: Date) {
    const totals = emptyTotals()
    const selected = rows.filter(
      (row) => row.startTime >= start && row.startTime < end
    )
    for (const row of selected) {
      totals.bookings++
      if (row.status === "cancelled") totals.cancelledSessions++
      if (row.status === "completed") totals.completedSessions++
      if (
        row.status === "completed" ||
        (row.status === "confirmed" && row.endTime <= now)
      ) {
        totals.sessions++
        totals.minutes += row.durationMinutes
      }
      if (row.currency === "KES") totals.spendKes += row.spendKes
    }
    totals.spendKes = round(totals.spendKes)
    totals.averageMinutes = totals.sessions
      ? round(totals.minutes / totals.sessions)
      : 0
    totals.averageSpendKes = totals.bookings
      ? round(totals.spendKes / totals.bookings)
      : 0
    return { totals, selected }
  }
  const current = summarize(range.start, range.end)
  const previous = summarize(range.previousStart, range.start)
  const format = (value: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-KE", {
      ...options,
      timeZone: "Africa/Nairobi",
    }).format(value)
  const label = (value: Date) =>
    format(
      value,
      period === "year"
        ? { year: "numeric" }
        : period === "month"
          ? { month: "long", year: "numeric" }
          : { day: "numeric", month: "long", year: "numeric" }
    )
  const buckets = []
  for (
    let wall = range.start.getTime() + OFFSET;
    wall < range.end.getTime() + OFFSET;
  ) {
    const start = new Date(wall - OFFSET)
    const next =
      period === "year"
        ? Date.UTC(
            new Date(wall).getUTCFullYear(),
            new Date(wall).getUTCMonth() + 1,
            1
          )
        : wall + (period === "day" ? 3600000 : 86400000)
    const summary = summarize(start, new Date(next - OFFSET))
    buckets.push({
      date: nairobiDate(start),
      label: format(
        start,
        period === "year"
          ? { month: "short" }
          : period === "month"
            ? { day: "numeric" }
            : { hour: "numeric", hour12: true }
      ),
      sessions: summary.totals.sessions,
      minutes: summary.totals.minutes,
      spendKes: summary.totals.spendKes,
    })
    wall = next
  }
  return {
    period,
    date,
    label: label(range.start),
    timezone: "Africa/Nairobi",
    currency: "KES",
    totals: current.totals,
    buckets,
    sessions: current.selected
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .map((row) => ({
        ...row,
        startTime: row.startTime.toISOString(),
        endTime: row.endTime.toISOString(),
      })),
    previous: { label: label(range.previousStart), totals: previous.totals },
    notes: [
      "Time is booked table duration for completed or elapsed confirmed bookings, not measured playing time.",
      "Spending is successful KES payments attributed to the booking date. Fully refunded payments are excluded; partial refund amounts are unavailable and remain included.",
    ],
  }
}
