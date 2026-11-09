import { StyleSheet, View } from "react-native"

import { ActivityRing } from "@/components/activity/activity-ring"
import { Button } from "@/components/kit/button"
import { PressableScale } from "@/components/kit/pressable-scale"
import { Sheet, type SheetDetent } from "@/components/kit/sheet"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { timeLabel } from "@/lib/stats-dates"
import {
  MAX_WEEKLY_GOAL_MINUTES,
  MIN_WEEKLY_GOAL_MINUTES,
  saveWeeklyGoal,
  useWeeklyGoal,
  WEEKLY_GOAL_STEP_MINUTES,
} from "@/lib/weekly-goal"

// A stable array: a new one each render made the Sheet rebuild its gesture on every tap.
const DETENTS: SheetDetent[] = ["content"]

type GoalSheetProps = {
  visible: boolean
  onClose: () => void
  /** Table time so far this week; when given, a ring previews the new goal. */
  weekMinutes?: number
}

/** Pick a weekly table-time goal with big − and + buttons. */
export function GoalSheet({ visible, onClose, weekMinutes }: GoalSheetProps) {
  const { colors } = useAppTheme()
  const goal = useWeeklyGoal()
  const canLower = goal > MIN_WEEKLY_GOAL_MINUTES
  const canRaise = goal < MAX_WEEKLY_GOAL_MINUTES

  return (
    <Sheet visible={visible} title="Weekly goal" detents={DETENTS} onClose={onClose}>
      <View style={styles.stack}>
        <AppText variant="body" color="secondaryLabel">
          How much time do you want at the table each week? Your ring fills as you play.
        </AppText>

        {weekMinutes !== undefined ? (
          <View style={styles.preview}>
            <ActivityRing
              size={132}
              lineWidth={22}
              progress={weekMinutes / goal}
              color={colors.accent}
              overlapColor={colors.accentText}
              capIconColor={colors.onAccent}
            />
          </View>
        ) : null}

        <View style={styles.stepper}>
          <PressableScale
            onPress={() => void saveWeeklyGoal(goal - WEEKLY_GOAL_STEP_MINUTES)}
            disabled={!canLower}
            haptic="selection"
            accessibilityLabel="Lower the goal by 30 minutes"
            style={[styles.round, { backgroundColor: colors.fill }]}
          >
            <IconSymbol name="minus" size={26} color={colors.accentText} />
          </PressableScale>
          <View style={styles.value} accessible accessibilityLiveRegion="polite" accessibilityLabel={`Goal ${timeLabel(goal)} a week`}>
            <AppText variant="largeTitle" tabular color="accentText">
              {timeLabel(goal)}
            </AppText>
            <AppText variant="subheadline" color="secondaryLabel">
              a week
            </AppText>
          </View>
          <PressableScale
            onPress={() => void saveWeeklyGoal(goal + WEEKLY_GOAL_STEP_MINUTES)}
            disabled={!canRaise}
            haptic="selection"
            accessibilityLabel="Raise the goal by 30 minutes"
            style={[styles.round, { backgroundColor: colors.fill }]}
          >
            <IconSymbol name="plus" size={26} color={colors.accentText} />
          </PressableScale>
        </View>

        <Button label="Done" onPress={onClose} />
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.lg },
  preview: { alignItems: "center" },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  round: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { alignItems: "center", minWidth: 120 },
})
