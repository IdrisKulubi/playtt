import { useFocusEffect } from "expo-router"
import { useCallback, useMemo, useRef, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"

import { ReplayClipActionsSheet } from "@/components/activity/replay-clip-actions-sheet"
import { ReplayDetailSheet } from "@/components/activity/replay-detail-sheet"
import { ReplayGridCard } from "@/components/activity/replay-grid-card"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { USE_LIVE_ACTIVITY_CLIPS } from "@/lib/mock/mock-config"
import type { ReplaySummary } from "@/lib/replay-types"
import {
  archiveReplay,
  deleteReplay,
  fetchUserReplays,
  patchReplayFavorite,
} from "@/lib/replays-api"
import { toast } from "@/lib/toast"

type ReplayLibraryProps = {
  onSelectedReplayChange?: (replay: ReplaySummary | null) => void
}

export function ReplayLibrary({ onSelectedReplayChange }: ReplayLibraryProps) {
  const theme = useProductTheme()
  const [replays, setReplays] = useState<ReplaySummary[]>([])
  const [loading, setLoading] = useState(USE_LIVE_ACTIVITY_CLIPS)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const [sheetReplay, setSheetReplay] = useState<ReplaySummary | null>(null)
  const [sheetAutoPlay, setSheetAutoPlay] = useState(false)
  const [actionsReplay, setActionsReplay] = useState<ReplaySummary | null>(null)

  const clearSelection = useCallback(() => {
    selectedIdRef.current = null
    setSelectedId(null)
    onSelectedReplayChange?.(null)
  }, [onSelectedReplayChange])

  const applyReplays = useCallback(
    (rows: ReplaySummary[]) => {
      setReplays(rows)

      if (rows.length === 0) {
        clearSelection()
        return
      }

      const previousId = selectedIdRef.current
      if (previousId && rows.some((row) => row.id === previousId)) {
        const replay = rows.find((row) => row.id === previousId) ?? null
        setSelectedId(previousId)
        onSelectedReplayChange?.(replay)
        return
      }

      if (previousId) {
        clearSelection()
      }
    },
    [clearSelection, onSelectedReplayChange],
  )

  const loadReplays = useCallback(() => {
    if (!USE_LIVE_ACTIVITY_CLIPS) {
      setLoading(false)
      setError(null)
      void fetchUserReplays().then(applyReplays)
      return
    }

    setLoading(true)
    setError(null)

    void fetchUserReplays()
      .then(applyReplays)
      .catch(() => {
        setError("Could not load your clips right now.")
        applyReplays([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [applyReplays])

  useFocusEffect(
    useCallback(() => {
      loadReplays()
    }, [loadReplays]),
  )

  const removeReplayFromList = useCallback(
    (replayId: string) => {
      setReplays((current) => current.filter((row) => row.id !== replayId))
      if (selectedIdRef.current === replayId) {
        clearSelection()
      }
    },
    [clearSelection],
  )

  const toggleSelectReplay = useCallback(
    (replay: ReplaySummary) => {
      if (selectedIdRef.current === replay.id) {
        clearSelection()
        return
      }

      selectedIdRef.current = replay.id
      setSelectedId(replay.id)
      onSelectedReplayChange?.(replay)
    },
    [clearSelection, onSelectedReplayChange],
  )

  const openSheet = useCallback((replay: ReplaySummary, autoPlay: boolean) => {
    setSheetAutoPlay(autoPlay)
    setSheetReplay(replay)
  }, [])

  const closeSheet = useCallback(() => {
    setSheetReplay(null)
    setSheetAutoPlay(false)
  }, [])

  const handleToggleFavorite = useCallback(
    (replay: ReplaySummary) => {
      const nextFavorite = !replay.isFavorite

      const applyLocal = () => {
        setReplays((current) =>
          current.map((row) =>
            row.id === replay.id
              ? { ...row, isFavorite: nextFavorite }
              : row,
          ),
        )
        if (selectedIdRef.current === replay.id) {
          onSelectedReplayChange?.({
            ...replay,
            isFavorite: nextFavorite,
          })
        }
      }

      if (!USE_LIVE_ACTIVITY_CLIPS) {
        applyLocal()
        toast.success(nextFavorite ? "Added to favorites." : "Removed from favorites.")
        return
      }

      void patchReplayFavorite(replay.id, nextFavorite)
        .then(() => {
          applyLocal()
          toast.success(
            nextFavorite ? "Added to favorites." : "Removed from favorites.",
          )
        })
        .catch(() => {
          toast.error("Could not update favorite.")
        })
    },
    [onSelectedReplayChange],
  )

  const handleArchive = useCallback(
    (replay: ReplaySummary) => {
      if (!USE_LIVE_ACTIVITY_CLIPS) {
        removeReplayFromList(replay.id)
        toast.success("Clip archived.")
        return
      }

      void archiveReplay(replay.id)
        .then(() => {
          removeReplayFromList(replay.id)
          toast.success("Clip archived.")
        })
        .catch(() => {
          toast.error("Could not archive this clip.")
        })
    },
    [removeReplayFromList],
  )

  const handleDelete = useCallback(
    (replay: ReplaySummary) => {
      if (!USE_LIVE_ACTIVITY_CLIPS) {
        removeReplayFromList(replay.id)
        toast.success("Clip deleted.")
        return
      }

      void deleteReplay(replay.id)
        .then(() => {
          removeReplayFromList(replay.id)
          toast.success("Clip deleted.")
        })
        .catch(() => {
          toast.error("Could not delete this clip.")
        })
    },
    [removeReplayFromList],
  )

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.md,
        },
        sectionHeader: {
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: PlayTTSpacing.sm,
        },
        sectionTitle: {
          fontSize: 17,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        sectionCount: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.muted,
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
        grid: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: PlayTTSpacing.sm,
        },
        cell: {
          width: "48%",
          flexGrow: 1,
          maxWidth: "48%",
        },
      }),
    [theme],
  )

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PlayTTColors.primary} />
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

  if (replays.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>
          No clips yet. Capture one during your next session.
        </Text>
      </View>
    )
  }

  const clipCountLabel =
    replays.length === 1 ? "1 clip" : `${replays.length} clips`

  return (
    <View style={styles.root}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your clips</Text>
        <Text style={styles.sectionCount}>{clipCountLabel}</Text>
      </View>
      <View style={styles.grid}>
        {replays.map((replay) => (
          <View key={replay.id} style={styles.cell}>
            <ReplayGridCard
              replay={replay}
              selected={replay.id === selectedId}
              onSelect={() => toggleSelectReplay(replay)}
              onPlay={() => openSheet(replay, true)}
              onMenu={() => setActionsReplay(replay)}
            />
          </View>
        ))}
      </View>

      <ReplayDetailSheet
        replay={sheetReplay}
        visible={sheetReplay !== null}
        autoPlay={sheetAutoPlay}
        onClose={closeSheet}
      />

      <ReplayClipActionsSheet
        replay={actionsReplay}
        visible={actionsReplay !== null}
        onClose={() => setActionsReplay(null)}
        onToggleFavorite={handleToggleFavorite}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />
    </View>
  )
}
