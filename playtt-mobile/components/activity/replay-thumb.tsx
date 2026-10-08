import { Image } from "expo-image"
import { useCallback, useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native"
import { Play } from "phosphor-react-native/src/icons/Play"

import { ReplayClipFramePreview } from "@/components/activity/replay-clip-frame-preview"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useReplayPoster } from "@/hooks/use-replay-poster"
import { useProductTheme } from "@/hooks/use-product-theme"
import { getCachedReplayPoster } from "@/lib/replay-poster"
import type { ReplaySummary } from "@/lib/replay-types"

type ReplayThumbProps = {
  replay?: ReplaySummary
  durationSeconds: number
  aspectRatio?: number
  style?: ViewStyle
  onPlayPress?: () => void
}

function apiPosterUri(replay: ReplaySummary) {
  if (!replay.posterUrl) {
    return getCachedReplayPoster(replay.id)
  }

  if (
    !replay.posterExpiresAt ||
    new Date(replay.posterExpiresAt).getTime() > Date.now() + 5000
  ) {
    return replay.posterUrl
  }

  return getCachedReplayPoster(replay.id)
}

export function ReplayThumb({
  replay,
  durationSeconds,
  aspectRatio = 16 / 9,
  style,
  onPlayPress,
}: ReplayThumbProps) {
  const theme = useProductTheme()
  const apiPoster = replay ? apiPosterUri(replay) : null
  const [useExtractedPoster, setUseExtractedPoster] = useState(false)

  const wantsExtractedPoster = Boolean(apiPoster) || useExtractedPoster
  const extractedPosterUri = useReplayPoster(replay ?? null, wantsExtractedPoster)
  const posterUri = apiPoster ?? extractedPosterUri

  const handleFrameFailed = useCallback(() => {
    setUseExtractedPoster(true)
  }, [])

  const showVideoFrame = Boolean(replay && !apiPoster && !useExtractedPoster)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        thumb: {
          width: "100%",
          aspectRatio,
          borderRadius: PlayTTRadius.lg,
          backgroundColor: theme.elevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: "rgba(255, 255, 255, 0.08)",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        },
        mediaLayer: {
          ...StyleSheet.absoluteFill,
        },
        playCircle: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "rgba(4, 16, 25, 0.72)",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "rgba(0, 183, 255, 0.45)",
          zIndex: 2,
        },
        duration: {
          position: "absolute",
          right: PlayTTSpacing.sm,
          bottom: PlayTTSpacing.sm,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: PlayTTSpacing["2xs"],
          borderRadius: 999,
          backgroundColor: "rgba(4, 16, 25, 0.78)",
          zIndex: 2,
        },
        durationText: {
          fontSize: 12,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        playPressed: {
          opacity: 0.85,
        },
        posterScrim: {
          ...StyleSheet.absoluteFill,
          backgroundColor: "rgba(4, 16, 25, 0.18)",
          zIndex: 1,
        },
      }),
    [aspectRatio, theme],
  )

  return (
    <View style={[styles.thumb, style]} pointerEvents="box-none">
      {showVideoFrame && replay ? (
        <ReplayClipFramePreview
          replay={replay}
          style={styles.mediaLayer}
          onFrameFailed={handleFrameFailed}
        />
      ) : null}
      {posterUri ? (
        <>
          <Image
            source={{ uri: posterUri }}
            style={styles.mediaLayer}
            contentFit="cover"
            cachePolicy="memory-disk"
            accessibilityElementsHidden
          />
          <View style={styles.posterScrim} pointerEvents="none" />
        </>
      ) : null}
      {onPlayPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Play clip"
          onPress={onPlayPress}
          style={({ pressed }) => [
            styles.playCircle,
            pressed && styles.playPressed,
          ]}
        >
          <Play size={20} color={PlayTTColors.primary} weight="fill" />
        </Pressable>
      ) : (
        <View style={styles.playCircle}>
          <Play size={20} color={PlayTTColors.primary} weight="fill" />
        </View>
      )}
      <View style={styles.duration} pointerEvents="none">
        <Text style={styles.durationText}>{durationSeconds}s</Text>
      </View>
    </View>
  )
}
