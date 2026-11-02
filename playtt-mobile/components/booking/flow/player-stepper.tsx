import { StyleSheet, View } from "react-native"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { GROUP_SIZE_OPTIONS, type GroupSize } from "@/lib/booking-types"

const MIN = GROUP_SIZE_OPTIONS[0]
const MAX = GROUP_SIZE_OPTIONS[GROUP_SIZE_OPTIONS.length - 1]
const BUTTON_SIZE = 64

type PlayerStepperProps = {
  value: GroupSize
  onChange: (next: GroupSize) => void
}

/** Big − / + with the number in the middle. Adjustable by swipe for screen readers. */
export function PlayerStepper({ value, onChange }: PlayerStepperProps) {
  const { colors } = useAppTheme()
  const canDecrease = value > MIN
  const canIncrease = value < MAX
  const step = (delta: number) => {
    const next = Math.min(MAX, Math.max(MIN, value + delta)) as GroupSize
    if (next !== value) onChange(next)
  }

  const roundButton = (delta: 1 | -1, enabled: boolean) => (
    <PressableScale
      onPress={() => step(delta)}
      disabled={!enabled}
      haptic="selection"
      // The adjustable row handles screen readers; these are for touch.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.round, { backgroundColor: colors.fill }]}
    >
      <IconSymbol name={delta > 0 ? "plus" : "minus"} size={28} color={colors.accentText} />
    </PressableScale>
  )

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Number of players"
      accessibilityValue={{ min: MIN, max: MAX, now: value, text: `${value} players` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "increment" ? 1 : -1)}
    >
      {roundButton(-1, canDecrease)}
      <View style={styles.value}>
        <AppText variant="largeTitle" tabular>
          {value}
        </AppText>
        <AppText variant="headline" color="secondaryLabel">
          players
        </AppText>
      </View>
      {roundButton(1, canIncrease)}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: PlayTTSpacing.md,
    paddingVertical: PlayTTSpacing.md,
  },
  round: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { flex: 1, alignItems: "center" },
})
