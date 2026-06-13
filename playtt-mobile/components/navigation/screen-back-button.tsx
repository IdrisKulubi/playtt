import { router } from "expo-router"
import { Pressable, StyleSheet } from "react-native"

import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTColors } from "@/constants/playtt-tokens"

type ScreenBackButtonProps = {
  onPress?: () => void
  color?: string
  size?: number
}

export function ScreenBackButton({
  onPress = () => router.back(),
  color = PlayTTColors.primary,
  size = 22,
}: ScreenBackButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      onPress={onPress}
      style={styles.button}
    >
      <IconSymbol name="chevron.left" size={size} color={color} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
})
