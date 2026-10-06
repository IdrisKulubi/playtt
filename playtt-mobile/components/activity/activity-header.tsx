import { useMemo } from "react"
import { Pressable, Text, View } from "react-native"

import { createActivityHeaderStyles } from "@/components/activity/activity-screen-styles"
import { PreviewBadge } from "@/components/ui/preview-badge"
import {
  PlayTTColors,
  PlayTTFontFamilies,
} from "@/constants/playtt-tokens"
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

  const clipLabel =
    clipBalance === null || clipBalance === undefined
      ? null
      : clipBalance === 1
        ? "1 clip left"
        : `${clipBalance} clips left`

  return (
    <View style={styles.band}>
      <View style={styles.topRow}>
        <Text style={styles.intro}>{INTRO_COPY[segment]}</Text>
        {previewLabel ? <PreviewBadge label={previewLabel} /> : null}
      </View>

      {segment === "highlights" && clipLabel && onBuyClips ? (
        <Pressable onPress={onBuyClips} style={styles.hairlineRow}>
          <Text style={styles.hairlineLabel}>{clipLabel}</Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: PlayTTFontFamilies.semiBold,
              color: PlayTTColors.primary,
            }}
          >
            Buy clips
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
