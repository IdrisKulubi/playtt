import { PingPong } from "phosphor-react-native/src/icons/PingPong"
import { useMemo } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { liquidGlassLabelColor, liquidGlassPillBorderColor } from "@/components/ui/liquid-glass-chrome"
import { LiquidGlassSurface, liquidGlassFill, useNativeLiquidGlass } from "@/components/ui/liquid-glass-surface"
import { getFloatingTabBarInset } from "@/constants/navigation-layout"
import { PlayTTColors, PlayTTFontFamilies, PlayTTRadius, PlayTTSpacing } from "@/constants/playtt-tokens"
import { resolveColorScheme } from "@/constants/theme"
import { useColorScheme } from "@/hooks/use-color-scheme"

import { OPEN_NOW_GREEN } from "./player-card/card-tiers"

type FloatingOpenButtonProps = {
  open: boolean
  onPress: () => void
}

/** Floating glass pill above the tab bar (liquid-glass-ui skill). */
export function FloatingOpenButton({ open, onPress }: FloatingOpenButtonProps) {
  const colorScheme = resolveColorScheme(useColorScheme())
  const nativeGlass = useNativeLiquidGlass()
  const insets = useSafeAreaInsets()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          position: "absolute",
          right: 20,
          bottom: getFloatingTabBarInset(insets.bottom) + PlayTTSpacing.sm,
        },
        pill: {
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.xs,
          paddingHorizontal: PlayTTSpacing.md,
          height: 48,
          borderRadius: PlayTTRadius.pill,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: liquidGlassPillBorderColor(colorScheme),
          ...(!nativeGlass
            ? Platform.select({
                ios: {
                  shadowColor: colorScheme === "dark" ? "#000000" : "#0a1628",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: colorScheme === "dark" ? 0.25 : 0.08,
                  shadowRadius: 12,
                },
                android: { elevation: 6 },
                default: {},
              })
            : {}),
        },
        dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: OPEN_NOW_GREEN },
        label: {
          fontFamily: PlayTTFontFamilies.semiBold,
          fontSize: 15,
          color: liquidGlassLabelColor(colorScheme, true),
        },
      }),
    [colorScheme, insets.bottom, nativeGlass],
  )

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? "You're open to play. Change status" : "Open to play"}
        onPress={onPress}
        style={styles.pill}
      >
        <LiquidGlassSurface colorScheme={colorScheme} style={liquidGlassFill} />
        {open ? <View style={styles.dot} /> : <PingPong size={18} color={PlayTTColors.primary} weight="bold" />}
        <Text style={styles.label}>{open ? "You're open" : "Open to play"}</Text>
      </Pressable>
    </View>
  )
}
