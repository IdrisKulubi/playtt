import { useVideoPlayer, VideoView } from "expo-video"
import { useCallback, useMemo, useState } from "react"
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { ReplayThumb } from "@/components/activity/replay-thumb"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { USE_LIVE_ACTIVITY_CLIPS } from "@/lib/mock/mock-config"
import { resolveReplayPlaybackUrl } from "@/lib/replays-api"
import type { ReplaySummary } from "@/lib/replay-types"

type ReplayPlayerProps = {
  replay: ReplaySummary
}

export function ReplayPlayer({ replay }: ReplayPlayerProps) {
  const theme = useProductTheme()
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const player = useVideoPlayer(sourceUrl, (instance) => {
    instance.loop = false
  })

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.sm,
        },
        video: {
          width: "100%",
          aspectRatio: 16 / 9,
          borderRadius: PlayTTRadius.lg,
          overflow: "hidden",
          backgroundColor: theme.elevated,
        },
        error: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          textAlign: "center",
          paddingVertical: PlayTTSpacing.sm,
        },
        loadingOverlay: {
          ...StyleSheet.absoluteFillObject,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(4, 16, 25, 0.55)",
          borderRadius: PlayTTRadius.lg,
        },
      }),
    [theme],
  )

  const startPlayback = useCallback(async () => {
    if (!USE_LIVE_ACTIVITY_CLIPS) {
      setError("Sample clips cannot be played. Turn on live replays to stream from your account.")
      return
    }

    if (replay.status !== "ready") {
      setError("This clip is still being prepared.")
      return
    }

    setError(null)
    setLoading(true)

    try {
      const url = await resolveReplayPlaybackUrl(replay)
      setSourceUrl(url)
      player.replace(url)
      player.play()
    } catch {
      setError("Could not start playback. Try again in a moment.")
    } finally {
      setLoading(false)
    }
  }, [player, replay])

  if (sourceUrl) {
    return (
      <View style={styles.root}>
        <VideoView
          style={styles.video}
          player={player}
          nativeControls
          contentFit="contain"
          allowsFullscreen
        />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={{ position: "relative" }}>
        <ReplayThumb
          durationSeconds={replay.durationSeconds}
          onPress={() => {
            void startPlayback()
          }}
        />
        {loading ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color={PlayTTColors.primary} />
          </View>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {replay.status !== "ready" && !error ? (
        <Text style={styles.error}>
          This clip is not ready to play yet ({replay.status}).
        </Text>
      ) : null}
    </View>
  )
}
