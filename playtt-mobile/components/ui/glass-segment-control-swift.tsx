import {
  Button,
  GlassEffectContainer,
  Host,
  HStack,
  Text,
} from "@expo/ui/swift-ui"
import {
  background,
  buttonStyle,
  font,
  foregroundStyle,
  glassEffect,
  padding,
} from "@expo/ui/swift-ui/modifiers"
import { useMemo } from "react"
import { StyleSheet, View } from "react-native"

import { Colors, resolveColorScheme } from "@/constants/theme"
import { ProductThemes } from "@/constants/product-theme"
import { PlayTTRadius } from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"
import { glassVariantForScheme } from "@/lib/liquid-glass"

type GlassSegmentControlSwiftProps<T extends string> = {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

export function GlassSegmentControlSwift<T extends string>({
  value,
  options,
  onChange,
}: GlassSegmentControlSwiftProps<T>) {
  const colorScheme = resolveColorScheme(useColorScheme())
  const productTheme = ProductThemes[colorScheme]
  const palette = Colors[colorScheme]
  const glassVariant = glassVariantForScheme(colorScheme)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          borderRadius: PlayTTRadius.lg,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: productTheme.border,
        },
        swiftHost: {
          minHeight: 36,
        },
      }),
    [productTheme.border],
  )

  return (
    <View style={styles.pill}>
      <Host style={styles.swiftHost} colorScheme={colorScheme} matchContents>
        <GlassEffectContainer spacing={4}>
          <HStack
            spacing={2}
            modifiers={[
              padding({ all: 3 }),
              glassEffect({
                glass: { variant: glassVariant },
                shape: "roundedRectangle",
                cornerRadius: PlayTTRadius.lg,
              }),
            ]}
          >
            {options.map((option) => {
              const active = option.value === value
              const textColor = active
                ? palette.tabIconSelected
                : palette.tabIconDefault

              return (
                <Button
                  key={option.value}
                  onPress={() => onChange(option.value)}
                  modifiers={[
                    buttonStyle("plain"),
                    ...(active
                      ? [
                          background(
                            colorScheme === "dark"
                              ? "rgba(255, 255, 255, 0.1)"
                              : "rgba(10, 22, 40, 0.08)",
                          ),
                        ]
                      : []),
                  ]}
                >
                  <Text
                    modifiers={[
                      font({ size: 12, weight: active ? "semibold" : "medium" }),
                      foregroundStyle({
                        type: "color",
                        color: textColor,
                      }),
                      padding({ vertical: 6, horizontal: 4 }),
                    ]}
                  >
                    {option.label}
                  </Text>
                </Button>
              )
            })}
          </HStack>
        </GlassEffectContainer>
      </Host>
    </View>
  )
}
