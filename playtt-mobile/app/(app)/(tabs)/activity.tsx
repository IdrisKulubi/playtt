import { useFocusEffect } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { ScrollView } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import { ActivityHeader } from "@/components/activity/activity-header"
import { PlayerStatsPanel } from "@/components/activity/player-stats-panel"
import { ReplayLibrary } from "@/components/activity/replay-library"
import {
  getReplayShareDockScrollPadding,
  ReplayShareDock,
} from "@/components/activity/replay-share-bar"
import { ClipPackPurchaseSheet } from "@/components/coach/clip-pack-purchase-sheet"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { GlassSegmentControl } from "@/components/ui/glass-segment-control"
import {
  FLOATING_TAB_BAR_CLEARANCE,
  getFloatingTabBarInset,
} from "@/constants/navigation-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { USE_LIVE_ACTIVITY_CLIPS } from "@/lib/mock/mock-config"
import type { ReplaySummary } from "@/lib/replay-types"
import { fetchActivityReplayCredits } from "@/lib/replay-credits-api"

type ActivitySegment = "highlights" | "stats"

export default function ActivityScreen() {
  const theme = useProductTheme()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])
  const insets = useSafeAreaInsets()
  const [segment, setSegment] = useState<ActivitySegment>("highlights")
  const [clipBalance, setClipBalance] = useState<number | null>(null)
  const [clipSheetOpen, setClipSheetOpen] = useState(false)
  const [dockReplay, setDockReplay] = useState<ReplaySummary | null>(null)

  const showShareDock =
    segment === "highlights" && dockReplay !== null && USE_LIVE_ACTIVITY_CLIPS

  const scrollPaddingBottom = showShareDock
    ? getReplayShareDockScrollPadding(insets.bottom)
    : FLOATING_TAB_BAR_CLEARANCE

  const loadCredits = useCallback(() => {
    void fetchActivityReplayCredits()
      .then((credits) => setClipBalance(credits.balance))
      .catch(() => setClipBalance(null))
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadCredits()
    }, [loadCredits]),
  )

  const handleSelectedReplayChange = useCallback(
    (replay: ReplaySummary | null) => {
      setDockReplay(replay)
    },
    [],
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { gap: PlayTTSpacing.lg, paddingBottom: scrollPaddingBottom },
        ]}
      >
        <ActivityHeader
          segment={segment}
          clipBalance={clipBalance}
          onBuyClips={() => setClipSheetOpen(true)}
        />

        <GlassSegmentControl
          value={segment}
          options={[
            { value: "highlights", label: "Highlights" },
            { value: "stats", label: "Stats" },
          ]}
          onChange={setSegment}
        />

        {segment === "highlights" ? (
          <ReplayLibrary onSelectedReplayChange={handleSelectedReplayChange} />
        ) : (
          <PlayerStatsPanel />
        )}
      </ScrollView>

      {showShareDock && dockReplay ? (
        <ReplayShareDock
          replay={dockReplay}
          bottomInset={getFloatingTabBarInset(insets.bottom)}
        />
      ) : null}

      <ClipPackPurchaseSheet
        visible={clipSheetOpen}
        onClose={() => setClipSheetOpen(false)}
        onPurchased={loadCredits}
      />
    </SafeAreaView>
  )
}
