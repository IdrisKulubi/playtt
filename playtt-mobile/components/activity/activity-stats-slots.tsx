import { ActivityStatsStickyChrome } from "@/components/activity/activity-stats-sticky-chrome"
import { useActivityStats } from "@/components/activity/activity-stats-context"

/** Renders inside the native View used by ScrollView stickyHeaderIndices. */
export function ActivityStatsStickySlot() {
  const stats = useActivityStats()
  return (
    <ActivityStatsStickyChrome>
      {stats.renderStickyBar()}
    </ActivityStatsStickyChrome>
  )
}

/** Direct ScrollView child — scrolls under pinned period chrome. */
export function ActivityStatsScrollSlot() {
  const stats = useActivityStats()
  return stats.renderScrollContent()
}

export function ActivityStatsOverlaysSlot() {
  const stats = useActivityStats()
  return stats.renderOverlays()
}

