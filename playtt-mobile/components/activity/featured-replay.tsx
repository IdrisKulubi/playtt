import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { ReplayThumb } from "@/components/activity/replay-thumb"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { ReplaySummary } from "@/lib/replay-types"

type FeaturedReplayProps = {
  replay: ReplaySummary
  onPress: () => void
}

function formatRecordedDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  })
}

export function FeaturedReplay({ replay, onPress }: FeaturedReplayProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.sm,
        },
        copy: {
          gap: PlayTTSpacing["2xs"],
        },
        title: {
          fontSize: 18,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        meta: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
        },
        pressed: {
          opacity: 0.92,
        },
      }),
    [theme],
  )

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <ReplayThumb durationSeconds={replay.durationSeconds} />
      <View style={styles.copy}>
        <Text style={styles.title}>{replay.title}</Text>
        <Text style={styles.meta}>
          {replay.locationName} · {formatRecordedDate(replay.recordedAt)}
        </Text>
      </View>
    </Pressable>
  )
}
