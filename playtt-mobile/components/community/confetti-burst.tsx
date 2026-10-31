import { useEffect, useMemo } from "react"
import { StyleSheet, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

const COLORS = ["#00b7ff", "#2ee87a", "#f5c84c", "#ff6b9a", "#ffffff"]
const PIECES = 18
const DURATION_MS = 900

function Piece({ index, color }: { index: number; color: string }) {
  const progress = useSharedValue(0)
  const angle = (index / PIECES) * Math.PI * 2
  const distance = 90 + (index % 4) * 22

  useEffect(() => {
    progress.value = withTiming(1, { duration: DURATION_MS, easing: Easing.out(Easing.cubic) })
  }, [progress])

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: Math.cos(angle) * distance * progress.value },
      // Slight gravity so pieces arc downwards.
      { translateY: Math.sin(angle) * distance * progress.value + 40 * progress.value * progress.value },
      { rotate: `${progress.value * 360}deg` },
    ],
  }))

  return <Animated.View style={[styles.piece, { backgroundColor: color }, style]} />
}

/** One-shot burst; remount (change `burstKey`) to play it again. */
export function ConfettiBurst({ burstKey }: { burstKey: number }) {
  const reduceMotion = useReducedMotion()
  const pieces = useMemo(
    () => Array.from({ length: PIECES }, (_, index) => ({ index, color: COLORS[index % COLORS.length] })),
    [],
  )

  if (burstKey === 0 || reduceMotion) {
    return null
  }

  return (
    <View key={burstKey} pointerEvents="none" style={styles.root}>
      {pieces.map((piece) => (
        <Piece key={piece.index} index={piece.index} color={piece.color} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  piece: {
    position: "absolute",
    width: 8,
    height: 12,
    borderRadius: 2,
  },
})
