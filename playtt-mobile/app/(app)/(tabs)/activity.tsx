import { useFocusEffect } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { ActivityHeader } from "@/components/activity/activity-header"
import { PlayerStatsPanel } from "@/components/activity/player-stats-panel"
import { ReplayLibrary } from "@/components/activity/replay-library"
import { ClipPackPurchaseSheet } from "@/components/coach/clip-pack-purchase-sheet"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { GlassSegmentControl } from "@/components/ui/glass-segment-control"
import { FLOATING_TAB_BAR_CLEARANCE } from "@/constants/navigation-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { fetchReplayCredits } from "@/lib/replay-credits-api"

type ActivitySegment = "highlights" | "stats"

export default function ActivityScreen() {
  const theme = useProductTheme()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])
  const [segment, setSegment] = useState<ActivitySegment>("highlights")
  const [clipBalance, setClipBalance] = useState<number | null>(null)
  const [clipSheetOpen, setClipSheetOpen] = useState(false)

  const loadCredits = useCallback(() => {
    void fetchReplayCredits()
      .then((credits) => setClipBalance(credits.balance))
      .catch(() => setClipBalance(null))
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadCredits()
    }, [loadCredits]),
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { gap: PlayTTSpacing.lg, paddingBottom: FLOATING_TAB_BAR_CLEARANCE },
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

        {segment === "highlights" ? <ReplayLibrary /> : <PlayerStatsPanel />}
      </ScrollView>

      <ClipPackPurchaseSheet
        visible={clipSheetOpen}
        onClose={() => setClipSheetOpen(false)}
        onPurchased={loadCredits}
      />
    </SafeAreaView>
  )
}
