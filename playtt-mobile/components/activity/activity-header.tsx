import { useMemo } from "react"
import { Text, View } from "react-native"

import { ClipBalanceBar } from "@/components/activity/clip-balance-bar"
import { createActivityHeaderStyles } from "@/components/activity/activity-screen-styles"
import { PreviewBadge } from "@/components/ui/preview-badge"
import { useProductTheme } from "@/hooks/use-product-theme"
import {
  MOCK_PREVIEW_LABEL,
  USE_LIVE_ACTIVITY_CLIPS,
  USE_MOCK_PLAYER_DATA,
} from "@/lib/mock/mock-config"

type ActivitySegment = "highlights" | "stats"

type ActivityHeaderProps = {
  segment: ActivitySegment
  clipBalance?: number | null
  onBuyClips?: () => void
}

const INTRO_COPY: Record<ActivitySegment, string> = {
  highlights: "Clips from your sessions",
  stats: "Your time on the table",
}

function previewBadgeForSegment(segment: ActivitySegment) {
  if (segment === "highlights" && !USE_LIVE_ACTIVITY_CLIPS) {
    return "Sample"
  }
  if (segment === "stats" && USE_MOCK_PLAYER_DATA) {
    return MOCK_PREVIEW_LABEL
  }
  return null
}

export function ActivityHeader({
  segment,
  clipBalance,
  onBuyClips,
}: ActivityHeaderProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createActivityHeaderStyles(theme), [theme])
  const previewLabel = previewBadgeForSegment(segment)

  return (
    <View style={styles.band}>
      <View style={styles.topRow}>
        <Text style={styles.leadHeadline}>Activity</Text>
        {previewLabel ? <PreviewBadge label={previewLabel} /> : null}
      </View>
      <Text style={styles.intro}>{INTRO_COPY[segment]}</Text>

      {segment === "highlights" && onBuyClips ? (
        <ClipBalanceBar balance={clipBalance ?? null} onBuyClips={onBuyClips} />
      ) : null}
    </View>
  )
}
