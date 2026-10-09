import { apiFetch } from "@/lib/api-client"

export type StatsPeriod = "year" | "month" | "day"
export type StatsTotals = {
  sessions: number
  minutes: number
  spendKes: number
  completedSessions: number
  cancelledSessions: number
  bookings: number
  averageMinutes: number
  averageSpendKes: number
}
export type StatsBucket = {
  date: string
  label: string
  sessions: number
  minutes: number
  spendKes: number
}
export type StatsSession = {
  id: string
  startTime: string
  endTime: string
  durationMinutes: number
  locationName: string
  resourceName: string
  totalKes: number
  spendKes: number
  status: string
  paymentStatus: string
  currency: string
}
export type ActivityStats = {
  period: StatsPeriod
  date: string
  label: string
  timezone: string
  currency: string
  totals: StatsTotals
  buckets: StatsBucket[]
  sessions: StatsSession[]
  previous: { label: string; totals: StatsTotals }
  notes: string[]
}

export async function fetchActivityStats(
  period: StatsPeriod,
  date: string
): Promise<ActivityStats> {
  const result = await apiFetch<{ data: ActivityStats }>(
    `/api/activity/stats?period=${period}&date=${encodeURIComponent(date)}`
  )
  return result.data
}
