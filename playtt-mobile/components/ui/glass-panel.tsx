import { useMemo, type ReactNode } from "react"
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"

import { liquidGlassPillBorderColor } from "@/components/ui/liquid-glass-chrome"
import {
  LiquidGlassSurface,
  liquidGlassFill,
  useNativeLiquidGlass,
} from "@/components/ui/liquid-glass-surface"
import { resolveColorScheme } from "@/constants/theme"
import { PlayTTRadius, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"

type GlassPanelProps = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
}

export function GlassPanel({ children, style, contentStyle }: GlassPanelProps) {
  const colorScheme = resolveColorScheme(useColorScheme())
  const nativeGlass = useNativeLiquidGlass()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shell: {
          borderRadius: PlayTTRadius.lg,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: liquidGlassPillBorderColor(colorScheme),
          ...(!nativeGlass
            ? Platform.select({
                ios: {
                  shadowColor: colorScheme === "dark" ? "#000000" : "#0a1628",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: colorScheme === "dark" ? 0.2 : 0.06,
                  shadowRadius: 10,
                },
                android: {
                  elevation: 4,
                },
                default: {},
              })
            : {}),
        },
        content: {
          padding: PlayTTSpacing.md,
        },
      }),
    [colorScheme, nativeGlass],
  )

  return (
    <View style={[styles.shell, style]}>
      <LiquidGlassSurface colorScheme={colorScheme} style={liquidGlassFill} />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  )
}
