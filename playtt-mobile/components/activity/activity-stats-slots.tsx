import { useActivityStats } from "@/components/activity/activity-stats-context"

/** The period picker and date row, above the numbers. */
export function ActivityStatsControlsSlot() {
  const stats = useActivityStats()
  return stats.renderControls()
}

/** The ring, chart and details. */
export function ActivityStatsScrollSlot() {
  const stats = useActivityStats()
  return stats.renderScrollContent()
}

export function ActivityStatsOverlaysSlot() {
  const stats = useActivityStats()
  return stats.renderOverlays()
}
