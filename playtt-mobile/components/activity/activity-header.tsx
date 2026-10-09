import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { ClipBalanceBar } from "@/components/activity/clip-balance-bar"
import { PreviewBadge } from "@/components/ui/preview-badge"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import {
  USE_LIVE_ACTIVITY_CLIPS,
  USE_LIVE_PLAYER_STATS,
} from "@/lib/mock/mock-config"

type ActivitySegment = "highlights" | "stats"

type ActivityHeaderProps = {
  segment: ActivitySegment
  clipBalance?: number | null
  onBuyClips?: () => void
}

const INTRO_COPY: Record<ActivitySegment, string> = {
  highlights: "Clips from your sessions",
  stats: "A closer look at your table time",
}

function previewBadgeForSegment(segment: ActivitySegment) {
  if (segment === "highlights" && !USE_LIVE_ACTIVITY_CLIPS) {
    return "Sample"
  }
  if (segment === "stats" && !USE_LIVE_PLAYER_STATS) {
    return "Sample"
  }
  return null
}

export function ActivityHeader({
  segment,
  clipBalance,
  onBuyClips,
}: ActivityHeaderProps) {
  const theme = useProductTheme()
  const previewLabel = previewBadgeForSegment(segment)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.xs,
        },
        topRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: PlayTTSpacing.sm,
        },
        leadHeadline: {
          ...PlayTTTypography.headline,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        intro: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 20,
          marginBottom: PlayTTSpacing["2xs"],
        },
        clipBar: {
          marginTop: PlayTTSpacing["2xs"],
        },
      }),
    [theme]
  )

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <Text style={styles.leadHeadline}>Activity</Text>
        {previewLabel ? <PreviewBadge label={previewLabel} /> : null}
      </View>
      <Text style={styles.intro}>{INTRO_COPY[segment]}</Text>

      {segment === "highlights" && onBuyClips ? (
        <View style={styles.clipBar}>
          <ClipBalanceBar
            balance={clipBalance ?? null}
            onBuyClips={onBuyClips}
          />
        </View>
      ) : null}
    </View>
  )
}
