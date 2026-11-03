import { StyleSheet, View } from "react-native"
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useActivityStats, ActivityStatsProvider } from "@/components/activity/activity-stats-context"
import {
  ActivityStatsControlsSlot,
  ActivityStatsOverlaysSlot,
  ActivityStatsScrollSlot,
} from "@/components/activity/activity-stats-slots"
import { STATS_HEADER_ROW, StatsHeader } from "@/components/activity/stats-header"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

function StatsBody() {
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()
  const stats = useActivityStats()
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y)
    },
  })

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + STATS_HEADER_ROW,
          paddingBottom: insets.bottom + PlayTTSpacing["2xl"],
          paddingHorizontal: KitLayout.screenGutter,
          gap: PlayTTSpacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        testID="stats-scroll"
      >
        <ActivityStatsControlsSlot />
        <ActivityStatsScrollSlot />
      </Animated.ScrollView>
      <StatsHeader
        title="Stats"
        scrollY={scrollY}
        onCalendar={stats.openPicker}
        onShare={stats.ready ? stats.openShare : undefined}
      />
      <ActivityStatsOverlaysSlot />
    </View>
  )
}

/** Detailed stats (year, month, day), opened from Progress. */
export default function StatsScreen() {
  return (
    <ActivityStatsProvider>
      <StatsBody />
    </ActivityStatsProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
