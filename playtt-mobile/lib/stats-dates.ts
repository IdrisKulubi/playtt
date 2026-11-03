import type { StatsPeriod } from "@/lib/activity-stats-api"

/** Date helpers for the stats screens. Dates are "YYYY-MM-DD" keys in Nairobi time. */

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`
}

export function parseDate(value: string) {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number) {
  const d = parseDate(key)
  return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}

/** The Monday of the week that contains this date. */
export function startOfWeek(key: string) {
  const day = parseDate(key).getDay() // 0 = Sunday
  return addDays(key, -((day + 6) % 7))
}

export function daysInMonth(key: string) {
  const d = parseDate(key)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

export function shiftStatsDate(date: string, period: StatsPeriod, direction: number) {
  const d = parseDate(date)
  return dateKey(
    period === "year"
      ? new Date(d.getFullYear() + direction, 0, 1)
      : period === "month"
        ? new Date(d.getFullYear(), d.getMonth() + direction, 1)
        : new Date(d.getFullYear(), d.getMonth(), d.getDate() + direction)
  )
}

/** "1h 30m", "45m", "2h". */
export function timeLabel(minutes: number) {
  const rounded = Math.round(minutes),
    hours = Math.floor(rounded / 60),
    rest = rounded % 60
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`
}

export function money(value: number) {
  return `KES ${Math.round(value).toLocaleString("en-KE")}`
}

export type Metric = "minutes" | "sessions" | "spendKes"

export const METRICS: { key: Metric; label: string }[] = [
  { key: "minutes", label: "Table time" },
  { key: "sessions", label: "Sessions" },
  { key: "spendKes", label: "Spending" },
]

export function metricValue(key: Metric, value: number) {
  return key === "minutes" ? timeLabel(value) : key === "spendKes" ? money(value) : value.toLocaleString("en-KE")
}
