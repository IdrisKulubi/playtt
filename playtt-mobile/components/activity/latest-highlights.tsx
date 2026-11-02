import { type ReactNode, useEffect, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"

import { ReplayThumb } from "@/components/activity/replay-thumb"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { Skeleton } from "@/components/ui/skeleton"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useSkeletonSurface } from "@/hooks/use-product-theme"
import { fetchUserReplays } from "@/lib/replays-api"
import type { ReplaySummary } from "@/lib/replay-types"

const MAX_HIGHLIGHTS = 6
const THUMB_WIDTH = 220

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return minutes > 0 ? `${minutes} min ${rest} s` : `${rest} s`
}

function formatRecorded(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })
}

type LatestHighlightsProps = {
  onOpen: (replay: ReplaySummary) => void
  /** Rendered when there are no replays yet. */
  empty: ReactNode
}

/** A row of big replay thumbnails, newest first. */
export function LatestHighlights({ onOpen, empty }: LatestHighlightsProps) {
  const skeletonSurface = useSkeletonSurface()
  const [replays, setReplays] = useState<ReplaySummary[] | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const rows = await fetchUserReplays()
        if (!mounted) return
        setReplays(
          rows
            .filter((row) => row.status === "ready")
            .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
            .slice(0, MAX_HIGHLIGHTS),
        )
      } catch {
        if (mounted) setReplays([])
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [])

  if (replays === null) {
    return <Skeleton surface={skeletonSurface} height={(THUMB_WIDTH * 9) / 16 + 44} borderRadius={16} width={THUMB_WIDTH} />
  }

  if (replays.length === 0) return <>{empty}</>

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.row}
    >
      {replays.map((replay) => (
        <PressableScale
          key={replay.id}
          onPress={() => onOpen(replay)}
          pressedScale={0.98}
          accessibilityLabel={`Replay from ${formatRecorded(replay.recordedAt)}, ${formatDuration(replay.durationSeconds)}`}
          accessibilityHint="Plays the replay"
          style={styles.item}
        >
          <View pointerEvents="none">
            <ReplayThumb replay={replay} durationSeconds={replay.durationSeconds} style={styles.thumb} />
          </View>
          <AppText variant="subheadline" weight="600" numberOfLines={1}>
            {formatRecorded(replay.recordedAt)}
          </AppText>
          <AppText variant="footnote" color="secondaryLabel" numberOfLines={1}>
            {formatDuration(replay.durationSeconds)} · {replay.locationName}
          </AppText>
        </PressableScale>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -KitLayout.screenGutter },
  row: { gap: PlayTTSpacing.sm, paddingHorizontal: KitLayout.screenGutter },
  item: { width: THUMB_WIDTH, gap: 2 },
  thumb: { borderRadius: 16, overflow: "hidden", marginBottom: PlayTTSpacing.xs },
})
