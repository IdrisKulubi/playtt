import type { Href } from "expo-router"
import { ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ActivityStatsProvider } from "@/components/activity/activity-stats-context"
import {
  ActivityStatsOverlaysSlot,
  ActivityStatsScrollSlot,
  ActivityStatsStickySlot,
} from "@/components/activity/activity-stats-slots"
import { StackHeader } from "@/components/kit/stack-header"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

const PROGRESS_HREF = "/(app)/(tabs)/activity" as Href

/** Detailed stats (year, month, day), opened from Progress. */
export default function StatsScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ActivityStatsProvider>
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + PlayTTSpacing.xs,
            paddingBottom: insets.bottom + PlayTTSpacing.xl,
            gap: PlayTTSpacing.md,
          }}
          showsVerticalScrollIndicator={false}
          // The period picker pins under the title while the details scroll.
          stickyHeaderIndices={[1]}
          testID="stats-scroll"
        >
          <StackHeader title="Stats" backLabel="Progress" fallbackHref={PROGRESS_HREF} />
          {/* ScrollView clones this child with native style/onLayout props. */}
          <View collapsable={false} style={styles.gutter} testID="activity-stats-sticky-boundary">
            <ActivityStatsStickySlot />
          </View>
          <View style={styles.gutter}>
            <ActivityStatsScrollSlot />
          </View>
        </ScrollView>
        <ActivityStatsOverlaysSlot />
      </ActivityStatsProvider>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gutter: { paddingHorizontal: KitLayout.screenGutter },
})
