import { useVideoPlayer, VideoView } from "expo-video"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { ReplayThumb } from "@/components/activity/replay-thumb"
import { PlayTTRadius, PlayTTSpacing } from "@/constants/playtt-tokens"
import { typeStyle } from "@/constants/type"
import { useAppTheme } from "@/hooks/use-app-theme"
import { USE_LIVE_ACTIVITY_CLIPS } from "@/lib/mock/mock-config"
import { resolveReplayPlaybackUrl } from "@/lib/replays-api"
import type { ReplaySummary } from "@/lib/replay-types"

type ReplayPlayerProps = {
  replay: ReplaySummary
  /** Start loading and playing as soon as the player mounts (e.g. list row tap). */
  autoPlay?: boolean
}

export function ReplayPlayer({ replay, autoPlay = false }: ReplayPlayerProps) {
  const { colors } = useAppTheme()
  const [showVideo, setShowVideo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoPlayStarted = useRef(false)

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = false
  })

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.sm,
        },
        videoShell: {
          position: "relative",
          width: "100%",
          aspectRatio: 16 / 9,
          borderRadius: PlayTTRadius.lg,
          overflow: "hidden",
          backgroundColor: colors.surface,
        },
        video: {
          width: "100%",
          height: "100%",
        },
        error: {
          ...typeStyle("subheadline"),
          color: colors.secondaryLabel,
          textAlign: "center",
          paddingVertical: PlayTTSpacing.sm,
        },
        loadingOverlay: {
          // Written out: absoluteFillObject no longer exists in this React Native version.
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(4, 16, 25, 0.55)",
        },
      }),
    [colors],
  )

  const startPlayback = useCallback(async () => {
    if (!USE_LIVE_ACTIVITY_CLIPS) {
      setError(
        "Sample clips cannot be played. Turn on live replays to stream from your account.",
      )
      return
    }

    if (replay.status !== "ready") {
      setError("This clip is still being prepared.")
      return
    }

    if (loading) return

    setError(null)
    setLoading(true)
    setShowVideo(true)

    try {
      const url = await resolveReplayPlaybackUrl(replay)
      player.replace(url)
      player.play()
    } catch {
      setShowVideo(false)
      setError("Could not start playback. Try again in a moment.")
    } finally {
      setLoading(false)
    }
  }, [loading, player, replay])

  useEffect(() => {
    if (!autoPlay || autoPlayStarted.current) return
    autoPlayStarted.current = true
    void startPlayback()
  }, [autoPlay, startPlayback])

  if (showVideo) {
    return (
      <View style={styles.root}>
        <View style={styles.videoShell}>
          <VideoView
            style={styles.video}
            player={player}
            nativeControls
            contentFit="contain"
            fullscreenOptions={{ enable: true }}
          />
          {loading ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator color={colors.accentText} />
            </View>
          ) : null}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={{ position: "relative" }}>
        <ReplayThumb
          durationSeconds={replay.durationSeconds}
          onPlayPress={() => {
            void startPlayback()
          }}
        />
        {loading ? (
          <View
            style={[styles.loadingOverlay, { borderRadius: PlayTTRadius.lg }]}
            pointerEvents="none"
          >
            <ActivityIndicator color={colors.accentText} />
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
