import { useMemo } from "react"
import { Pressable, Text, View } from "react-native"

import { createActivityHeaderStyles } from "@/components/activity/activity-screen-styles"
import { PreviewBadge } from "@/components/ui/preview-badge"
import {
  PlayTTColors,
  PlayTTFontFamilies,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

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

export function ActivityHeader({
  segment,
  clipBalance,
  onBuyClips,
}: ActivityHeaderProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createActivityHeaderStyles(theme), [theme])

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
        <PreviewBadge label="Sample" />
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
