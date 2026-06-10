import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { ReplayThumb } from "@/components/activity/replay-thumb"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { PreviewBadge } from "@/components/ui/preview-badge"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { MockReplay } from "@/lib/mock/mock-replays"

type ReplayDetailSheetProps = {
  replay: MockReplay | null
  visible: boolean
  onClose: () => void
}

export function ReplayDetailSheet({
  replay,
  visible,
  onClose,
}: ReplayDetailSheetProps) {
  const theme = useProductTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.md,
        },
        meta: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 20,
        },
        footnote: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
        },
        badgeRow: {
          alignSelf: "flex-start",
        },
      }),
    [theme],
  )

  if (!replay) {
    return null
  }

  const recordedLabel = new Date(replay.recordedAt).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <BottomSheet visible={visible} title={replay.title} onClose={onClose}>
      <View style={styles.root}>
        <ReplayThumb durationSeconds={replay.durationSeconds} />
        <Text style={styles.meta}>
          {replay.locationName} · {replay.durationSeconds}s · {recordedLabel}
        </Text>
        <View style={styles.badgeRow}>
          <PreviewBadge label="Sample" />
        </View>
        <Text style={styles.footnote}>
          Real replays will sync here after each session.
        </Text>
      </View>
    </BottomSheet>
  )
}
