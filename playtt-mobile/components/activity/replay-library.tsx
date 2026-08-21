import { useFocusEffect } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"

import { FeaturedReplay } from "@/components/activity/featured-replay"
import { ReplayDetailSheet } from "@/components/activity/replay-detail-sheet"
import { ReplayListRow } from "@/components/activity/replay-list-row"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { USE_LIVE_REPLAY_LIBRARY } from "@/lib/mock/mock-config"
import type { ReplaySummary } from "@/lib/replay-types"
import { fetchUserReplays } from "@/lib/replays-api"

function statusLabel(status: ReplaySummary["status"]) {
  switch (status) {
    case "queued":
      return "Queued"
    case "processing":
      return "Processing"
    case "ready":
      return "Ready"
    case "failed":
      return "Failed"
    default:
      return "Unknown"
  }
}

export function ReplayLibrary() {
  const theme = useProductTheme()
  const [replays, setReplays] = useState<ReplaySummary[]>([])
  const [loading, setLoading] = useState(USE_LIVE_REPLAY_LIBRARY)
  const [error, setError] = useState<string | null>(null)
  const [selectedReplay, setSelectedReplay] = useState<ReplaySummary | null>(
    null,
  )

  const loadReplays = useCallback(() => {
    if (!USE_LIVE_REPLAY_LIBRARY) {
      void fetchUserReplays().then(setReplays)
      return
    }

    setLoading(true)
    setError(null)

    void fetchUserReplays()
      .then((rows) => {
        setReplays(rows)
      })
      .catch(() => {
        setError("Could not load your clips right now.")
        setReplays([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadReplays()
    }, [loadReplays]),
  )

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.lg,
        },
        sectionLabel: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
        center: {
          alignItems: "center",
          paddingVertical: PlayTTSpacing.xl,
        },
        muted: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
        },
        statusPill: {
          fontSize: 12,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.muted,
        },
      }),
    [theme],
  )

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{error}</Text>
      </View>
    )
  }

  const featured = replays[0]
  const moreReplays = replays.slice(1)

  if (!featured) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No clips yet. Capture one during your next session.</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <FeaturedReplay
        replay={featured}
        onPress={() => setSelectedReplay(featured)}
      />

      {featured.status !== "ready" ? (
        <Text style={styles.statusPill}>{statusLabel(featured.status)}</Text>
      ) : null}

      {moreReplays.length > 0 ? (
        <View>
          <Text style={styles.sectionLabel}>Earlier clips</Text>
          {moreReplays.map((replay, index) => (
            <ReplayListRow
              key={replay.id}
              replay={replay}
              onPress={() => setSelectedReplay(replay)}
              isLast={index === moreReplays.length - 1}
            />
          ))}
        </View>
      ) : null}

      <ReplayDetailSheet
        replay={selectedReplay}
        visible={selectedReplay !== null}
        onClose={() => setSelectedReplay(null)}
      />
    </View>
  )
}
