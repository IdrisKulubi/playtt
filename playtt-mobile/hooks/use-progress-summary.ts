import { useCallback, useEffect, useState } from "react"

import { fetchActivityStats, type ActivityStats } from "@/lib/activity-stats-api"
import { sampleActivityStats } from "@/lib/mock/mock-activity-stats"
import { USE_LIVE_PLAYER_STATS } from "@/lib/mock/mock-config"
import { addDays, startOfWeek, todayKey } from "@/lib/stats-dates"

const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const

export type WeekDay = {
  key: string
  initial: string
  minutes: number
  sessions: number
  isToday: boolean
  isFuture: boolean
}

type Loaded = {
  month: ActivityStats
  week: WeekDay[]
  weekMinutes: number
  weekSessions: number
  weekStart: string
}

export function loadMonth(key: string) {
  return USE_LIVE_PLAYER_STATS ? fetchActivityStats("month", key) : Promise.resolve(sampleActivityStats("month", key))
}

/** Seven days from `weekStart`, filled from whichever months' stats cover them. */
export function buildWeek(weekStart: string, today: string, stats: (ActivityStats | undefined)[]): WeekDay[] {
  const byDay = new Map<string, { minutes: number; sessions: number }>()
  for (const monthStats of stats) {
    for (const bucket of monthStats?.buckets ?? []) {
      byDay.set(bucket.date.slice(0, 10), { minutes: bucket.minutes, sessions: bucket.sessions })
    }
  }
  return WEEKDAY_INITIALS.map((initial, index) => {
    const key = addDays(weekStart, index)
    const day = byDay.get(key)
    return {
      key,
      initial,
      minutes: day?.minutes ?? 0,
      sessions: day?.sessions ?? 0,
      isToday: key === today,
      isFuture: key > today,
    }
  })
}

/** The first of each month a week touches (a week can straddle two). */
export function monthsOfWeek(weekStart: string) {
  return [...new Set([weekStart, addDays(weekStart, 6)].map((key) => `${key.slice(0, 7)}-01`))]
}

/**
 * This month's numbers plus this week's days (Monday to Sunday), for the
 * Progress summary. The week can start in last month, so that month is
 * fetched too when needed.
 */
export function useProgressSummary() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let active = true
    const today = todayKey()
    const monthStart = `${today.slice(0, 7)}-01`
    const weekStart = startOfWeek(today)
    const previousMonthStart = `${addDays(monthStart, -1).slice(0, 7)}-01`

    const requests = [loadMonth(monthStart)]
    if (weekStart < monthStart) requests.push(loadMonth(previousMonthStart))

    void Promise.all(requests)
      .then(([month, previousMonth]) => {
        if (!active) return
        const week = buildWeek(weekStart, today, [month, previousMonth])
        setFailed(false)
        setLoaded({
          month,
          week,
          weekStart,
          weekMinutes: week.reduce((sum, day) => sum + day.minutes, 0),
          weekSessions: week.reduce((sum, day) => sum + day.sessions, 0),
        })
      })
      .catch(() => {
        if (active) setFailed(true)
      })

    return () => {
      active = false
    }
  }, [reloadCount])

  const reload = useCallback(() => {
    setFailed(false)
    setReloadCount((value) => value + 1)
  }, [])

  return { ...loaded, loading: !loaded && !failed, failed, reload }
}
