import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { ReplayPlayer } from "@/components/activity/replay-player"
import { ReplayShareBar } from "@/components/activity/replay-share-bar"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { ReplaySummary } from "@/lib/replay-types"

type FeaturedReplayProps = {
  replay: ReplaySummary
}

function formatRecordedDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  })
}

export function FeaturedReplay({ replay }: FeaturedReplayProps) {
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
      }),
    [theme],
  )

  return (
    <View style={styles.root}>
      <ReplayPlayer key={replay.id} replay={replay} />
      <ReplayShareBar replay={replay} />
      <View style={styles.copy}>
        <Text style={styles.title}>{replay.title}</Text>
        <Text style={styles.meta}>
          {replay.locationName} · {formatRecordedDate(replay.recordedAt)}
        </Text>
      </View>
    </View>
  )
}
