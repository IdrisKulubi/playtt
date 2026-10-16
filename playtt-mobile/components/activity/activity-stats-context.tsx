import { createContext, useContext, type ReactNode } from "react"

import { usePlayerStatsApi } from "@/components/activity/player-stats-panel"

type ActivityStatsApi = ReturnType<typeof usePlayerStatsApi>

const ActivityStatsContext = createContext<ActivityStatsApi | null>(null)

export function ActivityStatsProvider({ children }: { children: ReactNode }) {
  const api = usePlayerStatsApi()
  return (
    <ActivityStatsContext.Provider value={api}>
      {children}
    </ActivityStatsContext.Provider>
  )
}

export function useActivityStats() {
  const api = useContext(ActivityStatsContext)
  if (!api) {
    throw new Error("useActivityStats must be used within ActivityStatsProvider")
  }
  return api
}
