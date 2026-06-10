import { useMemo, useState } from "react"
import { ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { ActivityHeader } from "@/components/activity/activity-header"
import { PlayerStatsPanel } from "@/components/activity/player-stats-panel"
import { ReplayLibrary } from "@/components/activity/replay-library"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { SegmentControl } from "@/components/ui/segment-control"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

type ActivitySegment = "highlights" | "stats"

export default function ActivityScreen() {
  const theme = useProductTheme()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])
  const [segment, setSegment] = useState<ActivitySegment>("highlights")

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { gap: PlayTTSpacing.lg, paddingBottom: PlayTTSpacing["2xl"] },
        ]}
      >
        <ActivityHeader segment={segment} />

        <SegmentControl
          value={segment}
          options={[
            { value: "highlights", label: "Highlights" },
            { value: "stats", label: "Stats" },
          ]}
          onChange={setSegment}
        />

        {segment === "highlights" ? <ReplayLibrary /> : <PlayerStatsPanel />}
      </ScrollView>
    </SafeAreaView>
  )
}
