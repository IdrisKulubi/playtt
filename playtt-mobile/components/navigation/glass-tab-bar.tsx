import type { BottomTabBarProps } from "@react-navigation/bottom-tabs"
import * as Haptics from "expo-haptics"
import { useCallback, useMemo } from "react"
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  LiquidGlassFallback,
  liquidGlassFallbackFill,
} from "@/components/ui/liquid-glass-fallback"
import { Colors, resolveColorScheme } from "@/constants/theme"
import {
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"

const VISIBLE_TAB_NAMES = [
  "index",
  "bookings",
  "activity",
  "community",
  "account",
] as const

const TAB_ICON_SIZE = 20
const ACTIVE_ICON_RING_SIZE = 36

const TAB_SYSTEM_ICONS = {
  index: "house.fill",
  bookings: "calendar",
  activity: "chart.bar.fill",
  community: "person.2.fill",
  account: "person.fill",
} as const

type TabBarOptions = {
  title?: string
  tabBarIcon?: (props: {
    focused: boolean
    color: string
    size: number
  }) => React.ReactNode
}

function isVisibleTab(routeName: string): routeName is (typeof VISIBLE_TAB_NAMES)[number] {
  return (VISIBLE_TAB_NAMES as readonly string[]).includes(routeName)
}

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const colorScheme = resolveColorScheme(useColorScheme())
  const palette = Colors[colorScheme]

  const visibleRoutes = useMemo(
    () =>
      state.routes.filter(
        (route): route is (typeof state.routes)[number] & {
          name: (typeof VISIBLE_TAB_NAMES)[number]
        } => isVisibleTab(route.name),
      ),
    [state],
  )

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: PlayTTSpacing.md,
          paddingTop: PlayTTSpacing.xs,
        },
        pill: {
          borderRadius: PlayTTRadius.pill,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor:
            colorScheme === "dark"
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(10, 22, 40, 0.08)",
          ...Platform.select({
            ios: {
              shadowColor: colorScheme === "dark" ? "#000000" : "#0a1628",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: colorScheme === "dark" ? 0.35 : 0.1,
              shadowRadius: 16,
            },
            android: {
              elevation: 10,
            },
            default: {},
          }),
        },
        row: {
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-around",
          paddingVertical: 6,
          paddingHorizontal: PlayTTSpacing.xs,
          minHeight: 44,
        },
        tab: {
          flex: 1,
          alignItems: "center",
          justifyContent: "flex-end",
        },
        iconSlot: {
          width: ACTIVE_ICON_RING_SIZE,
          height: ACTIVE_ICON_RING_SIZE,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: ACTIVE_ICON_RING_SIZE / 2,
        },
        iconSlotActive: {
          backgroundColor:
            colorScheme === "dark"
              ? "rgba(255, 255, 255, 0.14)"
              : "rgba(10, 22, 40, 0.1)",
        },
        label: {
          marginTop: 2,
          fontSize: 9,
          fontFamily: PlayTTFontFamilies.medium,
          color: palette.tabIconDefault,
          textAlign: "center",
        },
        labelActive: {
          fontFamily: PlayTTFontFamilies.semiBold,
          color: palette.tabIconSelected,
        },
      }),
    [colorScheme, palette.tabIconDefault, palette.tabIconSelected],
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
        <LiquidGlassFallback
          colorScheme={colorScheme}
          intensity={95}
          style={liquidGlassFallbackFill}
        />

        <View style={styles.row}>
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
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={label}
                onPress={() =>
                  handleTabPress(route.key, route.name, route.params, isFocused)
                }
                onLongPress={() => handleTabLongPress(route.key)}
                style={styles.tab}
              >
                <View style={[styles.iconSlot, isFocused && styles.iconSlotActive]}>
                  {tabOptions.tabBarIcon?.({
                    focused: isFocused,
                    color: iconColor,
                    size: TAB_ICON_SIZE,
                  }) ?? (
                    <IconSymbol
                      size={TAB_ICON_SIZE}
                      name={TAB_SYSTEM_ICONS[route.name]}
                      color={iconColor}
                    />
                  )}
                </View>
                <Text
                  style={[styles.label, isFocused && styles.labelActive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    </View>
  )
}
