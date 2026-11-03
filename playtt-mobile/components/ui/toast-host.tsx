import { useCallback, useEffect, useState, type ComponentProps } from "react"
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { liquidGlassPillBorderColor } from "@/components/ui/liquid-glass-chrome"
import {
  LiquidGlassSurface,
  liquidGlassFill,
  useNativeLiquidGlass,
} from "@/components/ui/liquid-glass-surface"
import type { ColorRoles } from "@/constants/colors"
import {
  DRAG_THRESHOLD,
  FADE_QUICK,
  projectMomentum,
  rubberband,
  spring,
} from "@/constants/motion"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { setToastListener, type ToastPayload, type ToastVariant } from "@/lib/toast"

/** Long enough to read slowly: 4 s, plus time for longer messages, up to 8 s. */
function readingTimeMs(message: string) {
  return Math.min(8000, Math.max(4000, 2000 + message.length * 50))
}

/** Gap between the safe area and the banner. */
const TOP_GAP = 8

const VARIANT_ICON: Record<ToastVariant, ComponentProps<typeof IconSymbol>["name"]> = {
  success: "checkmark.circle.fill",
  error: "exclamationmark.triangle.fill",
  info: "info.circle.fill",
}

function variantTint(variant: ToastVariant, colors: ColorRoles) {
  if (variant === "success") return colors.success
  if (variant === "error") return colors.destructive
  return colors.accentText
}

/**
 * A glass banner that drops in from the top, like an iPhone notification.
 * It reads itself out, waits while touched, and goes away on its own,
 * on a tap, or when swiped up.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets()
  const { scheme, colors } = useAppTheme()
  const reducedMotion = useReducedMotion()
  const nativeGlass = useNativeLiquidGlass()
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const [held, setHeld] = useState(false)

  const height = useSharedValue(72)
  const offset = useSharedValue(-200)
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0)
  const dragStart = useSharedValue(0)
  const topInset = insets.top + TOP_GAP

  useEffect(() => {
    setToastListener(setToast)
    return () => setToastListener(null)
  }, [])

  const clear = useCallback(() => setToast(null), [])

  const hide = useCallback(
    (velocity = 0) => {
      const onDone = (finished?: boolean) => {
        "worklet"
        if (finished) runOnJS(clear)()
      }
      if (reducedMotion) {
        opacity.set(withTiming(0, FADE_QUICK, onDone))
        return
      }
      offset.set(withSpring(-(height.get() + topInset + 24), spring("default", velocity), onDone))
    },
    [clear, height, offset, opacity, reducedMotion, topInset],
  )

  // Arrive: drop in from above the screen (or fade, with Reduce Motion).
  // A new message while one is showing swaps in place with a small nudge.
  useEffect(() => {
    if (!toast) return
    const alreadyShowing = opacity.get() === 1 && offset.get() > -height.get()

    if (reducedMotion) {
      offset.set(0)
      scale.set(1)
      opacity.set(withTiming(1, FADE_QUICK))
    } else {
      if (!alreadyShowing) {
        offset.set(-(height.get() + topInset + 24))
        scale.set(0.9)
      } else {
        scale.set(0.96)
      }
      opacity.set(1)
      offset.set(withSpring(0, spring("default")))
      scale.set(withSpring(1, spring("default")))
    }

    AccessibilityInfo.announceForAccessibility(
      toast.action ? `${toast.message}. ${toast.action.label} available.` : toast.message,
    )
  }, [toast, reducedMotion, height, offset, opacity, scale, topInset])

  // Leave by itself once there was time to read it; never while a finger is on it.
  useEffect(() => {
    if (!toast || held) return
    const timeoutId = setTimeout(() => hide(), toast.durationMs ?? readingTimeMs(toast.message))
    return () => clearTimeout(timeoutId)
  }, [toast, held, hide])

  const pan = Gesture.Pan()
    .activeOffsetY([-DRAG_THRESHOLD, DRAG_THRESHOLD])
    .onBegin(() => {
      runOnJS(setHeld)(true)
    })
    .onStart(() => {
      cancelAnimation(offset)
      dragStart.set(offset.get())
    })
    .onUpdate((event) => {
      const raw = dragStart.get() + event.translationY
      // Up follows the finger; down resists, there is nowhere to go.
      offset.set(raw > 0 ? rubberband(raw, height.get()) : raw)
    })
    .onEnd((event) => {
      const projected = offset.get() + projectMomentum(event.velocityY)
      if (projected < -height.get() / 2) {
        runOnJS(hide)(event.velocityY)
      } else {
        offset.set(withSpring(0, spring("default", event.velocityY)))
      }
    })
    .onFinalize(() => {
      runOnJS(setHeld)(false)
    })

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(hide)(0)
  })

  const gesture = Gesture.Exclusive(pan, tap)

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: offset.get() }, { scale: scale.get() }],
  }))

  if (!toast) return null

  const tint = variantTint(toast.variant, colors)

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: topInset }]}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          onLayout={(event) => height.set(event.nativeEvent.layout.height)}
          style={[styles.shadow, !nativeGlass && styles.shadowVisible, bannerStyle]}
        >
          <View
            style={[
              styles.banner,
              { borderColor: liquidGlassPillBorderColor(scheme) },
              toast.action ? styles.bannerWithAction : null,
            ]}
          >
            <LiquidGlassSurface colorScheme={scheme} style={liquidGlassFill} />
            <IconSymbol name={VARIANT_ICON[toast.variant]} size={26} color={tint} />
            <View
              style={styles.message}
              accessible
              accessibilityRole="alert"
              accessibilityLabel={toast.message}
              accessibilityHint="Tap or swipe up to dismiss"
              accessibilityActions={[{ name: "activate", label: "Dismiss" }, { name: "escape" }]}
              onAccessibilityAction={() => hide()}
            >
              <AppText variant="callout" weight="600" numberOfLines={3}>
                {toast.message}
              </AppText>
            </View>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={toast.action.label}
                hitSlop={8}
                onPress={() => {
                  toast.action?.onPress()
                  hide()
                }}
                style={({ pressed }) => [
                  styles.action,
                  { backgroundColor: colors.fill, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <AppText variant="body" weight="600" color="accentText">
                  {toast.action.label}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: PlayTTSpacing.md,
    right: PlayTTSpacing.md,
    alignItems: "center",
    zIndex: 1000,
  },
  shadow: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 28,
  },
  // Native Liquid Glass brings its own depth; everywhere else, a soft lift.
  shadowVisible: {
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  banner: {
    minHeight: 60,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing.sm,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 22,
  },
  bannerWithAction: { paddingRight: 8, paddingVertical: 8 },
  message: { flex: 1 },
  action: {
    minHeight: 44,
    minWidth: 64,
    borderRadius: 22,
    paddingHorizontal: PlayTTSpacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
})
