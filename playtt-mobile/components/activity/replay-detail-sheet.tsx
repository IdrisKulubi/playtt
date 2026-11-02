import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { ReplayPlayer } from "@/components/activity/replay-player"
import { ReplayShareBar } from "@/components/activity/replay-share-bar"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { PreviewBadge } from "@/components/ui/preview-badge"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { typeStyle } from "@/constants/type"
import { useAppTheme } from "@/hooks/use-app-theme"
import { USE_LIVE_ACTIVITY_CLIPS } from "@/lib/mock/mock-config"
import type { ReplaySummary } from "@/lib/replay-types"

type ReplayDetailSheetProps = {
  replay: ReplaySummary | null
  visible: boolean
  autoPlay?: boolean
  onClose: () => void
}

export function ReplayDetailSheet({
  replay,
  visible,
  autoPlay = false,
  onClose,
}: ReplayDetailSheetProps) {
  const { colors } = useAppTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.md,
        },
        meta: {
          ...typeStyle("subheadline"),
          color: colors.secondaryLabel,
        },
        footnote: {
          ...typeStyle("footnote"),
          color: colors.secondaryLabel,
        },
        badgeRow: {
          alignSelf: "flex-start",
        },
      }),
    [colors],
  )

  if (!replay) {
    return null
  }

  const recordedLabel = new Date(replay.recordedAt).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  const showLiveBadge = USE_LIVE_ACTIVITY_CLIPS

  return (
    <BottomSheet visible={visible} title={replay.title} onClose={onClose}>
      <View style={styles.root}>
        <ReplayPlayer
          key={`${replay.id}-${autoPlay ? "autoplay" : "manual"}`}
          replay={replay}
          autoPlay={autoPlay}
        />
        <Text style={styles.meta}>
          {replay.locationName} · {replay.durationSeconds}s · {recordedLabel}
        </Text>
        <ReplayShareBar replay={replay} />
        <View style={styles.badgeRow}>
          {showLiveBadge ? (
            <PreviewBadge
              label={
                replay.status === "ready"
                  ? "Ready"
                  : replay.status === "failed"
                    ? "Failed"
                    : "Processing"
              }
            />
          ) : (
            <PreviewBadge label="Sample" />
          )}
        </View>
        <Text style={styles.footnote}>
          {showLiveBadge
            ? replay.status === "ready"
              ? autoPlay
                ? "Streaming your clip. Use the player controls to pause or go fullscreen."
                : "Tap play to stream your clip."
              : "This clip is still being prepared on the venue edge."
            : "Real replays will sync here after each session."}
        </Text>
      </View>
    </BottomSheet>
  )
}
