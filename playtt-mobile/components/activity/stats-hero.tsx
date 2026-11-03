import { StyleSheet, useWindowDimensions, View } from "react-native"

import { ActivityRing } from "@/components/activity/activity-ring"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { timeLabel } from "@/lib/stats-dates"

type StatsHeroProps = {
  minutes: number
  /** Table time that closes the ring for the period being shown. */
  goalMinutes: number
  /** Names the goal under the number: "your weekly goal", "your monthly pace". */
  goalName: string
  onChangeGoal: () => void
}

/**
 * The big ring from Apple's Activity screen, for table time in the period
 * you're looking at: the ring, then the number in colour beside a goal button.
 */
export function StatsHero({ minutes, goalMinutes, goalName, onChangeGoal }: StatsHeroProps) {
  const { colors } = useAppTheme()
  const { width } = useWindowDimensions()
  const size = Math.min(width - KitLayout.screenGutter * 2 - 64, 248)
  const percent = goalMinutes > 0 ? Math.round((minutes / goalMinutes) * 100) : 0

  return (
    <View style={styles.root}>
      <View
        style={styles.ring}
        accessible
        accessibilityLabel={`${timeLabel(minutes)} at the table, ${percent} percent of ${goalName}`}
      >
        <ActivityRing
          size={size}
          lineWidth={Math.round(size * 0.17)}
          progress={goalMinutes > 0 ? minutes / goalMinutes : 0}
          color={colors.accent}
          overlapColor={colors.accentText}
          capIconColor={colors.onAccent}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.text}>
          <AppText variant="title3">Table time</AppText>
          <View style={styles.value}>
            <AppText variant="largeTitle" tabular color="accentText" maxFontSizeMultiplier={1.3}>
              {timeLabel(minutes)}
            </AppText>
            <AppText variant="subheadline" weight="700" color="accentText" maxFontSizeMultiplier={1.3}>
              / {timeLabel(goalMinutes)}
            </AppText>
          </View>
          <AppText variant="subheadline" color="secondaryLabel">
            {percent}% of {goalName}
          </AppText>
        </View>
        <PressableScale
          onPress={onChangeGoal}
          accessibilityLabel="Change your weekly goal"
          style={[styles.goal, { backgroundColor: colors.fill }]}
        >
          <IconSymbol name="slider.horizontal.3" size={24} color={colors.accentText} />
        </PressableScale>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: PlayTTSpacing.lg },
  ring: { alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.md },
  text: { flex: 1, gap: 2 },
  value: { flexDirection: "row", alignItems: "baseline", gap: PlayTTSpacing.xs },
  goal: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
})
