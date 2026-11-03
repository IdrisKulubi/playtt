import { useEffect, useMemo, useState } from "react"
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native"
import Animated, {
  Easing,
  FadeInUp,
  FadeOutUp,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { IconSymbol } from "@/components/ui/icon-symbol"
import { AppColors, type ColorRoles } from "@/constants/colors"
import { PlayTTElevation, PlayTTRadius, PlayTTSpacing } from "@/constants/playtt-tokens"
import { typeStyle } from "@/constants/type"
import { useColorScheme } from "@/hooks/use-color-scheme"
import { useAppTheme } from "@/hooks/use-app-theme"
import {
  setToastListener,
  type ToastPayload,
  type ToastVariant,
} from "@/lib/toast"

const TOAST_DURATION_MS = 4200
const ENTER_MS = 240
const EXIT_MS = 200

type ToastIconName =
  | "checkmark.circle.fill"
  | "xmark.circle.fill"
  | "info.circle.fill"

type VariantConfig = {
  icon: ToastIconName
  iconColor: string
  iconBackground: string
}

function getVariantConfig(
  variant: ToastVariant,
  isDark: boolean,
  colors: ColorRoles,
): VariantConfig {
  switch (variant) {
    case "success":
      return {
        icon: "checkmark.circle.fill",
        iconColor: isDark ? "#5ee6a0" : "#0f9d58",
        iconBackground: isDark
          ? "rgba(94, 230, 160, 0.12)"
          : "rgba(15, 157, 88, 0.1)",
      }
    case "error":
      return {
        icon: "xmark.circle.fill",
        iconColor: isDark ? "#ff6961" : colors.destructive,
        iconBackground: isDark
          ? "rgba(255, 105, 97, 0.12)"
          : "rgba(255, 59, 48, 0.08)",
      }
    case "info":
      return {
        icon: "info.circle.fill",
        iconColor: colors.accentText,
        iconBackground: isDark
          ? "rgba(0, 183, 255, 0.14)"
          : "rgba(0, 183, 255, 0.1)",
      }
  }
}

export function ToastHost() {
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const [toast, setToast] = useState<ToastPayload | null>(null)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        host: {
          position: "absolute",
          left: PlayTTSpacing.lg,
          right: PlayTTSpacing.lg,
          zIndex: 1000,
        },
        toast: {
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: PlayTTRadius.lg,
          paddingVertical: PlayTTSpacing.sm,
          paddingHorizontal: PlayTTSpacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.sm,
          backgroundColor: colors.surface,
          borderColor: colors.separator,
          ...(isDark ? PlayTTElevation.soft : PlayTTElevation.productCard),
        },
        iconWrap: {
          width: 32,
          height: 32,
          borderRadius: PlayTTRadius.md,
          alignItems: "center",
          justifyContent: "center",
        },
        message: {
          ...typeStyle("subheadline", "500"),
          flex: 1,
          color: colors.label,
        },
        dismiss: {
          width: 32,
          height: 32,
          alignItems: "center",
          justifyContent: "center",
        },
        action: {
          minHeight: 44,
          paddingHorizontal: PlayTTSpacing.sm,
          alignItems: "center",
          justifyContent: "center",
        },
        actionLabel: {
          color: AppColors[isDark ? "dark" : "light"].accentText,
          fontSize: 17,
          fontWeight: "600",
        },
      }),
    [isDark, colors.separator, colors.surface, colors.label],
  )

  useEffect(() => {
    setToastListener((nextToast) => {
      setToast(nextToast)
    })

    return () => {
      setToastListener(null)
    }
  }, [])

  useEffect(() => {
    if (!toast) {
      return
    }

    const announcement = toast.action
      ? `${toast.message}. ${toast.action.label} available.`
      : toast.message
    AccessibilityInfo.announceForAccessibility(announcement)

    const timeoutId = setTimeout(() => {
      setToast(null)
    }, toast.durationMs ?? TOAST_DURATION_MS)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [toast])

  if (!toast) {
    return null
  }

  const variant = getVariantConfig(toast.variant, isDark, colors)

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 10 }]}>
      <Animated.View
        entering={FadeInUp.duration(ENTER_MS).easing(
          Easing.out(Easing.cubic),
        )}
        exiting={FadeOutUp.duration(EXIT_MS).easing(Easing.in(Easing.cubic))}
        style={styles.toast}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: variant.iconBackground },
          ]}
        >
          <IconSymbol
            name={variant.icon}
            size={18}
            color={variant.iconColor}
          />
        </View>

        <Text style={styles.message} numberOfLines={3}>
          {toast.message}
        </Text>

        {toast.action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toast.action.label}
            hitSlop={8}
            onPress={() => {
              toast.action?.onPress()
              setToast(null)
            }}
            style={styles.action}
          >
            <Text style={styles.actionLabel}>{toast.action.label}</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          hitSlop={6}
          onPress={() => setToast(null)}
          style={styles.dismiss}
        >
          <IconSymbol name="xmark" size={16} color={colors.secondaryLabel} />
        </Pressable>
      </Animated.View>
    </View>
  )
}
