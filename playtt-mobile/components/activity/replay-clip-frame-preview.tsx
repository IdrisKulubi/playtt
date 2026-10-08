import { useVideoPlayer, VideoView } from "expo-video"
import { useEffect, useMemo, useState } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"

import { USE_LIVE_ACTIVITY_CLIPS } from "@/lib/mock/mock-config"
import type { ReplaySummary } from "@/lib/replay-types"
import { resolveReplayPlaybackUrl } from "@/lib/replays-api"
import { useProductTheme } from "@/hooks/use-product-theme"

type ReplayClipFramePreviewProps = {
  replay: ReplaySummary
  style?: StyleProp<ViewStyle>
  onFrameReady?: () => void
  onFrameFailed?: () => void
}

const MAX_ACTIVE_PREVIEWS = 5
let activePreviewCount = 0
const previewWaiters: Array<() => void> = []

function acquirePreviewSlot() {
  if (activePreviewCount < MAX_ACTIVE_PREVIEWS) {
    activePreviewCount += 1
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    previewWaiters.push(() => {
      activePreviewCount += 1
      resolve()
    })
  })
}

function releasePreviewSlot() {
  activePreviewCount -= 1
  const next = previewWaiters.shift()
  next?.()
}

function canPreviewReplay(replay: ReplaySummary) {
  if (!USE_LIVE_ACTIVITY_CLIPS) {
    return false
  }
  if (replay.status === "failed" || replay.status === "queued") {
    return false
  }
  return true
}

function previewSeekSeconds(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0.5
  }
  return Math.min(2, Math.max(0.35, durationSeconds * 0.12))
}

export function ReplayClipFramePreview({
  replay,
  style,
  onFrameReady,
  onFrameFailed,
}: ReplayClipFramePreviewProps) {
  const theme = useProductTheme()
  const [hasSlot, setHasSlot] = useState(false)
  const [frameVisible, setFrameVisible] = useState(false)

  const player = useVideoPlayer(null, (instance) => {
    instance.muted = true
    instance.loop = false
  })

  const styles = useMemo(
    () =>
      StyleSheet.create({
        fill: {
          ...StyleSheet.absoluteFill,
        },
        placeholder: {
          ...StyleSheet.absoluteFill,
          backgroundColor: theme.elevated,
        },
      }),
    [theme],
  )

  useEffect(() => {
    if (!canPreviewReplay(replay)) {
      return
    }

    let cancelled = false
    let slotHeld = false

    void acquirePreviewSlot().then(() => {
      if (cancelled) {
        releasePreviewSlot()
        return
      }
      slotHeld = true
      setHasSlot(true)
    })

    return () => {
      cancelled = true
      if (slotHeld) {
        releasePreviewSlot()
      }
    }
  }, [replay.id])

  useEffect(() => {
    if (!hasSlot || !canPreviewReplay(replay)) {
      return
    }

    let cancelled = false
    setFrameVisible(false)

    const subscription = player.addListener("statusChange", ({ status, error }) => {
      if (status === "readyToPlay") {
        player.pause()
        player.currentTime = previewSeekSeconds(replay.durationSeconds)
        setFrameVisible(true)
        onFrameReady?.()
        return
      }

      if (status === "error") {
        onFrameFailed?.()
        if (error) {
          console.warn("[ReplayClipFramePreview] playback error", replay.id, error.message)
        }
      }
    })

    void resolveReplayPlaybackUrl(replay)
      .then((url) => {
        if (cancelled) {
          return
        }
        return player.replaceAsync(url)
      })
      .catch(() => {
        onFrameFailed?.()
      })

    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [
    hasSlot,
    onFrameFailed,
    onFrameReady,
    player,
    replay.durationSeconds,
    replay.id,
    replay.playbackExpiresAt,
    replay.videoUrl,
    replay.status,
  ])

  useEffect(() => {
    return () => {
      player.release()
    }
  }, [player])

  if (!hasSlot || !canPreviewReplay(replay)) {
    return <View style={[styles.placeholder, style]} />
  }

  return (
    <View style={style} pointerEvents="none">
      {!frameVisible ? <View style={styles.placeholder} /> : null}
      <VideoView
        player={player}
        style={styles.fill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </View>
  )
}
