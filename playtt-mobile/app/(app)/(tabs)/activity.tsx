import { useFocusEffect } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ActivityHeader } from "@/components/activity/activity-header"
import { ActivityStatsProvider } from "@/components/activity/activity-stats-context"
import {
  ActivityStatsOverlaysSlot,
  ActivityStatsScrollSlot,
  ActivityStatsStickySlot,
} from "@/components/activity/activity-stats-slots"
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

  const scrollPaddingBottom = useMemo(() => {
    if (showShareDock) {
      return getReplayShareDockScrollPadding(insets.bottom)
    }
    if (segment === "stats") {
      return getFloatingTabBarInset(insets.bottom) + PlayTTSpacing.lg
    }
    return FLOATING_TAB_BAR_CLEARANCE
  }, [insets.bottom, segment, showShareDock])

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

  const scrollContentStyle = useMemo(
    () => ({
      paddingTop: insets.top + PlayTTSpacing.sm,
      paddingHorizontal: 20,
      paddingBottom: scrollPaddingBottom,
      gap: PlayTTSpacing.md,
    }),
    [insets.top, scrollPaddingBottom],
  )

  const stickyHeaderIndices =
    segment === "stats" ? [2] : undefined

  const scrollBody = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={scrollContentStyle}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={stickyHeaderIndices}
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
        // ScrollView clones this child with native style/onLayout props.
        <View collapsable={false} testID="activity-stats-sticky-boundary">
          <ActivityStatsStickySlot />
        </View>
      )}

      {segment === "stats" ? <ActivityStatsScrollSlot /> : null}
    </ScrollView>
  )

  return (
    <View style={styles.safeArea}>
      {segment === "stats" ? (
        <ActivityStatsProvider>
          {scrollBody}
          <ActivityStatsOverlaysSlot />
        </ActivityStatsProvider>
      ) : (
        scrollBody
      )}

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
    </View>
  )
}
