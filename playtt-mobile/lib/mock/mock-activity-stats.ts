/** Explicit offline demo only; live stats never fall back to sample data. */
import type {
  ActivityStats,
  StatsPeriod,
  StatsSession,
  StatsTotals,
} from "@/lib/activity-stats-api"

const empty = (): StatsTotals => ({
  sessions: 0,
  minutes: 0,
  spendKes: 0,
  completedSessions: 0,
  cancelledSessions: 0,
  bookings: 0,
  averageMinutes: 0,
  averageSpendKes: 0,
})
export function sampleActivityStats(
  period: StatsPeriod,
  date: string
): ActivityStats {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const count =
    period === "year"
      ? 12
      : period === "month"
        ? new Date(year, month, 0).getDate()
        : 24
  const buckets = Array.from({ length: count }, (_, index) => {
    const sessions =
      period === "year"
        ? [2, 3, 4, 3, 2, 4, 1, 3, 4, 2, 3, 2][index]
        : period === "month"
          ? [2, 5, 9, 14, 18, 23, 27].includes(index + 1)
            ? 1
            : 0
          : [10, 18].includes(index)
            ? 1
            : 0
    return {
      date:
        period === "year"
          ? `${year}-${String(index + 1).padStart(2, "0")}-01`
          : period === "month"
            ? `${date.slice(0, 7)}-${String(index + 1).padStart(2, "0")}`
            : `${date}T${String(index).padStart(2, "0")}:00:00+03:00`,
      label:
        period === "year"
          ? new Date(year, index, 1).toLocaleString("en-KE", { month: "short" })
          : String(period === "month" ? index + 1 : index),
      sessions,
      minutes: sessions * 90,
      spendKes: sessions * 2400,
    }
  })
  const totals = buckets.reduce(
    (sum, b) => ({
      ...sum,
      sessions: sum.sessions + b.sessions,
      minutes: sum.minutes + b.minutes,
      spendKes: sum.spendKes + b.spendKes,
    }),
    empty()
  )
  totals.completedSessions = totals.sessions
  totals.bookings = totals.sessions
  totals.averageMinutes = totals.sessions ? 90 : 0
  totals.averageSpendKes = totals.sessions ? 2400 : 0
  const sessions: StatsSession[] = buckets
    .filter((b) => b.sessions)
    .flatMap((b, i) =>
      Array.from({ length: b.sessions }, (_, j) => ({
        id: `sample-${i}-${j}`,
        startTime:
          period === "day" ? b.date : `${b.date.slice(0, 10)}T18:00:00+03:00`,
        endTime:
          period === "day"
            ? new Date(
                new Date(b.date).getTime() + 90 * 60 * 1000
              ).toISOString()
            : `${b.date.slice(0, 10)}T19:30:00+03:00`,
        durationMinutes: 90,
        locationName: i % 2 ? "Westlands" : "Kilimani",
        resourceName: "Table 01",
        totalKes: 2400,
        spendKes: 2400,
        status: "completed",
        paymentStatus: "paid",
        currency: "KES",
      }))
    )
  const label = new Date(year, month - 1, day).toLocaleString(
    "en-KE",
    period === "year"
      ? { year: "numeric" }
      : period === "month"
        ? { month: "long", year: "numeric" }
        : { day: "numeric", month: "long", year: "numeric" }
  )
  return {
    period,
    date,
    label,
    timezone: "Africa/Nairobi",
    currency: "KES",
    totals,
    buckets,
    sessions,
    previous: {
      label: "previous period",
      totals: {
        ...totals,
        sessions: Math.max(0, totals.sessions - 2),
        minutes: Math.max(0, totals.minutes - 180),
        spendKes: Math.max(0, totals.spendKes - 4800),
      },
    },
    notes: [
      "Sample bookings for exploring your stats. Booked duration is not a measurement of time played.",
    ],
  }
}
