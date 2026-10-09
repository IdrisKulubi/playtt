import * as Haptics from "expo-haptics"
import { useMemo } from "react"
import { SignOut } from "phosphor-react-native/src/icons/SignOut"
import { useProductTheme } from "@/hooks/use-product-theme"
import { Pressable, StyleSheet, Text } from "react-native"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
type AccountSignOutButtonProps = {
  label: string
  disabled?: boolean
  onPress: () => void
}

export function AccountSignOutButton({
  label,
  disabled = false,
  onPress,
}: AccountSignOutButtonProps) {
  const theme = useProductTheme()
  const destructiveColor =
    theme.statusBar === "light"
      ? PlayTTColors.destructive
      : PlayTTColors.productDestructive
  const styles = useMemo(
    () =>
      StyleSheet.create({
        pressable: {
          paddingVertical: PlayTTSpacing.md,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          minHeight: 48,
        },
        pressed: {
          opacity: 0.88,
        },
        label: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: destructiveColor,
        },
        disabled: {
          opacity: 0.5,
        },
      }),
    [destructiveColor],
  )

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        if (!disabled && process.env.EXPO_OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
      }}
      style={({ pressed }) => [
        styles.pressable,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <SignOut size={18} color={destructiveColor} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}
