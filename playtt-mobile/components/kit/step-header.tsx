import { useEffect } from "react"
import { StyleSheet, View } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"

import { AppText } from "@/components/ui/app-text"
import { spring } from "@/constants/motion"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

type StepHeaderProps = {
  /** 1-based. */
  step: number
  total: number
  /** What this step asks, e.g. "Pick a time". */
  title: string
}

/** "Step 2 of 3" in words plus a bar, so nobody wonders how much is left. */
export function StepHeader({ step, total, title }: StepHeaderProps) {
  const { colors } = useAppTheme()
  const progress = useSharedValue(step / total)

  useEffect(() => {
    progress.set(withSpring(step / total, spring("default")))
  }, [progress, step, total])

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }))
  const stepWords = `Step ${step} of ${total}`

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${stepWords}: ${title}`}
      accessibilityValue={{ min: 1, max: total, now: step, text: stepWords }}
    >
      <AppText variant="footnote" color="secondaryLabel" weight="600">
        {stepWords}
      </AppText>
      <View style={[styles.track, { backgroundColor: colors.fill }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.accent }, fillStyle]} />
      </View>
      <AppText variant="title2">{title}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: PlayTTSpacing.xs },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
})
