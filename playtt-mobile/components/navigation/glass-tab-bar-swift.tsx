import type { BottomTabBarProps } from "@react-navigation/bottom-tabs"
import {
  Button,
  GlassEffectContainer,
  Host,
  HStack,
  Image,
  Text,
  VStack,
} from "@expo/ui/swift-ui"
import {
  buttonStyle,
  font,
  foregroundStyle,
  glassEffect,
  onLongPressGesture,
  padding,
} from "@expo/ui/swift-ui/modifiers"
import type { SFSymbol } from "sf-symbols-typescript"
import * as Haptics from "expo-haptics"
import { useCallback, useMemo } from "react"
import { Platform, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Colors, resolveColorScheme } from "@/constants/theme"
import { PlayTTRadius, PlayTTSpacing } from "@/constants/playtt-tokens"
import { ProductThemes } from "@/constants/product-theme"
import { useColorScheme } from "@/hooks/use-color-scheme"
import {
  glassVariantForScheme,
  TAB_SYSTEM_ICONS,
} from "@/lib/liquid-glass"

const VISIBLE_TAB_NAMES = [
  "index",
  "bookings",
  "activity",
  "community",
  "account",
] as const

const TAB_ICON_SIZE = 22

type TabBarOptions = {
  title?: string
}

function isVisibleTab(routeName: string): routeName is (typeof VISIBLE_TAB_NAMES)[number] {
  return (VISIBLE_TAB_NAMES as readonly string[]).includes(routeName)
}

function getTabSystemIcon(routeName: (typeof VISIBLE_TAB_NAMES)[number]): SFSymbol {
  return TAB_SYSTEM_ICONS[routeName]
}

export function GlassTabBarSwift({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const colorScheme = resolveColorScheme(useColorScheme())
  const palette = Colors[colorScheme]
  const productTheme = ProductThemes[colorScheme]
  const glassVariant = glassVariantForScheme(colorScheme)

  const visibleRoutes = useMemo(
    () =>
      state.routes.filter(
        (route): route is (typeof state.routes)[number] & {
          name: (typeof VISIBLE_TAB_NAMES)[number]
        } => isVisibleTab(route.name),
      ),
    [state.routes],
  )

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingTop: PlayTTSpacing.xs,
        },
        pill: {
          borderRadius: PlayTTRadius.panel,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: productTheme.border,
          ...Platform.select({
            ios: {
              shadowColor: colorScheme === "dark" ? "#020810" : "#0a1628",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: colorScheme === "dark" ? 0.45 : 0.12,
              shadowRadius: 24,
            },
            android: {
              elevation: 12,
            },
            default: {},
          }),
        },
        swiftHost: {
          minHeight: 54,
        },
      }),
    [colorScheme, productTheme.border],
  )

  const bottomPadding = Math.max(insets.bottom, PlayTTSpacing.sm)

  const handleTabPress = useCallback(
    (routeKey: string, routeName: string, routeParams: object | undefined, isFocused: boolean) => {
      if (process.env.EXPO_OS === "ios") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }

      const event = navigation.emit({
        type: "tabPress",
        target: routeKey,
        canPreventDefault: true,
      })

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(routeName, routeParams)
      }
    },
    [navigation],
  )

  const handleTabLongPress = useCallback(
    (routeKey: string) => {
      navigation.emit({
        type: "tabLongPress",
        target: routeKey,
      })
    },
    [navigation],
  )

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPadding }]}>
      <View style={styles.pill}>
        <Host style={styles.swiftHost} colorScheme={colorScheme} matchContents>
          <GlassEffectContainer spacing={8}>
            <HStack
              spacing={0}
              alignment="center"
              modifiers={[
                padding({ horizontal: PlayTTSpacing.xs, vertical: PlayTTSpacing.xs }),
                glassEffect({
                  glass: { variant: glassVariant },
                  shape: "roundedRectangle",
                  cornerRadius: PlayTTRadius.panel,
                }),
              ]}
            >
              {visibleRoutes.map((route) => {
                const routeIndex = state.routes.indexOf(route)
                const { options } = descriptors[route.key]
                const tabOptions = options as TabBarOptions
                const label = tabOptions.title ?? route.name
                const isFocused = state.index === routeIndex
                const iconColor = isFocused
                  ? palette.tabIconSelected
                  : palette.tabIconDefault

                return (
                  <Button
                    key={route.key}
                    onPress={() =>
                      handleTabPress(route.key, route.name, route.params, isFocused)
                    }
                    modifiers={[
                      buttonStyle("plain"),
                      onLongPressGesture(() => handleTabLongPress(route.key)),
                    ]}
                  >
                    <VStack spacing={2} alignment="center">
                      <Image
                        systemName={getTabSystemIcon(route.name)}
                        size={TAB_ICON_SIZE}
                        color={iconColor}
                      />
                      <Text
                        modifiers={[
                          font({ size: 10, weight: isFocused ? "semibold" : "medium" }),
                          foregroundStyle({
                            type: "color",
                            color: iconColor,
                          }),
                        ]}
                      >
                        {label}
                      </Text>
                    </VStack>
                  </Button>
                )
              })}
            </HStack>
          </GlassEffectContainer>
        </Host>
      </View>
    </View>
  )
}
