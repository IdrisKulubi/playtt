import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler"
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import {
  DRAG_THRESHOLD,
  FADE_QUICK,
  nearestSnapPoint,
  projectMomentum,
  rubberband,
  spring,
} from "@/constants/motion"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { haptics } from "@/lib/haptics"

export type SheetDetent = "medium" | "large" | number

const DETENT_FRACTIONS = { medium: 0.5, large: 0.92 } as const

/** Release speed (px/s) that counts as a flick and earns a little bounce. */
const FLICK_VELOCITY = 300

/** Hidden extra height under the sheet so rubber-banding up never shows a gap. */
const OVERDRAG_ROOM = 120

// Captured directly by worklets; runOnJS can't reach functions nested in objects.
const commitHaptic = haptics.commit

type SheetProps = {
  visible: boolean
  title: string
  /** Called once the sheet has finished closing from the user's side. */
  onClose: () => void
  children: ReactNode
  /** Heights as screen fractions; "medium" = 0.5, "large" = 0.92. */
  detents?: SheetDetent[]
  /** Index into the sorted detents to open at. */
  initialDetent?: number
  /** Scrollable bodies drag only from the header, so scrolling still works. */
  scrollable?: boolean
  /** Set false for tasks that must be finished or cancelled with a button. */
  dismissible?: boolean
}

function toFraction(detent: SheetDetent): number {
  return typeof detent === "number" ? detent : DETENT_FRACTIONS[detent]
}

/**
 * Bottom sheet with Apple-style physics: follows the finger 1:1, can be
 * grabbed mid-animation, hands release velocity to the spring, projects
 * momentum to pick a detent, rubber-bands past its edges, and closes the
 * way it opened. Under reduced motion it cross-fades instead of sliding.
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  detents = ["large"],
  initialDetent = 0,
  scrollable = false,
  dismissible = true,
}: SheetProps) {
  const { height: screenHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()
  const reducedMotion = useReducedMotion()
  const [mounted, setMounted] = useState(visible)

  const { stops, sheetHeight } = useMemo(() => {
    const fractions = [...new Set(detents.map(toFraction))].sort((a, b) => a - b)
    const largest = fractions[fractions.length - 1]
    return {
      sheetHeight: largest * screenHeight,
      // translateY for each detent, smallest detent first (largest offset).
      stops: fractions.map((fraction) => (largest - fraction) * screenHeight),
    }
  }, [detents, screenHeight])

  const closed = sheetHeight
  const openStop = stops[Math.min(Math.max(initialDetent, 0), stops.length - 1)]

  const translateY = useSharedValue(closed)
  const fade = useSharedValue(reducedMotion ? 0 : 1)
  const dragStart = useSharedValue(0)
  const restingStop = useSharedValue(openStop)

  const finishUnmount = useCallback(() => setMounted(false), [])

  // Mount as soon as we're asked to show; unmounting waits for the close animation.
  if (visible && !mounted) setMounted(true)

  // Open and parent-driven close.
  useEffect(() => {
    if (visible) {
      restingStop.set(openStop)
      if (reducedMotion) {
        translateY.set(openStop)
        fade.set(withTiming(1, FADE_QUICK))
      } else {
        fade.set(1)
        translateY.set(withSpring(openStop, spring("default")))
      }
      return
    }

    const done = (finished?: boolean) => {
      "worklet"
      if (finished) runOnJS(finishUnmount)()
    }
    // Already closed by the user's gesture? The spring completes at once.
    if (reducedMotion) {
      fade.set(withTiming(0, FADE_QUICK, done))
    } else {
      translateY.set(withSpring(closed, spring("default"), done))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on visibility changes only
  }, [visible])

  /** User-initiated close (scrim, Close button, back): animate, then tell the parent. */
  const requestDismiss = useCallback(() => {
    const done = (finished?: boolean) => {
      "worklet"
      if (finished) runOnJS(onClose)()
    }
    if (reducedMotion) {
      fade.set(withTiming(0, FADE_QUICK, done))
    } else {
      translateY.set(withSpring(closed, spring("default"), done))
    }
  }, [closed, fade, onClose, reducedMotion, translateY])

  const settle = (velocity: number) => {
    "worklet"
    const config = spring(Math.abs(velocity) > FLICK_VELOCITY ? "sheet" : "default", velocity)
    const projected = translateY.get() + projectMomentum(velocity)
    const candidates = dismissible ? [...stops, closed] : stops
    const target = nearestSnapPoint(projected, candidates)

    if (target === closed) {
      translateY.set(
        withSpring(closed, config, (finished) => {
          if (finished) runOnJS(onClose)()
        }),
      )
      return
    }

    if (target !== restingStop.get()) runOnJS(commitHaptic)()
    restingStop.set(target)
    translateY.set(withSpring(target, config))
  }

  const pan = Gesture.Pan()
    .enabled(visible)
    .activeOffsetY([-DRAG_THRESHOLD, DRAG_THRESHOLD])
    // Touch-down freezes the sheet where it is, so it can be caught mid-flight.
    .onBegin(() => {
      cancelAnimation(translateY)
    })
    .onStart(() => {
      dragStart.set(translateY.get())
    })
    .onUpdate((event) => {
      const raw = dragStart.get() + event.translationY
      const top = stops[stops.length - 1]
      const bottom = stops[0]
      if (raw < top) {
        translateY.set(top + rubberband(raw - top, sheetHeight))
      } else if (!dismissible && raw > bottom) {
        translateY.set(bottom + rubberband(raw - bottom, sheetHeight))
      } else {
        translateY.set(raw)
      }
    })
    .onEnd((event) => {
      settle(event.velocityY)
    })
    .onFinalize((_event, success) => {
      // A tap that froze the sheet but never became a drag: carry on settling.
      if (!success) settle(0)
    })

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ translateY: translateY.get() }],
  }))

  const scrimStyle = useAnimatedStyle(() => ({
    opacity:
      fade.get() * interpolate(translateY.get(), [0, closed], [1, 0], Extrapolation.CLAMP),
  }))

  const header = (
    <View style={styles.header}>
      <View style={[styles.handle, { backgroundColor: colors.separator }]} />
      <View style={styles.titleRow}>
        <AppText variant="title3" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        {dismissible ? (
          <PressableScale
            onPress={requestDismiss}
            accessibilityLabel={`Close ${title}`}
            style={styles.close}
          >
            <AppText variant="body" color="accentText" weight="600">
              Close
            </AppText>
          </PressableScale>
        ) : null}
      </View>
    </View>
  )

  const body = scrollable ? (
    <ScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={{ paddingBottom: insets.bottom + PlayTTSpacing.md }}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ paddingBottom: insets.bottom + PlayTTSpacing.md }}>{children}</View>
  )

  const sheetSurface = (
    <Animated.View
      accessibilityViewIsModal
      style={[
        styles.sheet,
        {
          height: sheetHeight + OVERDRAG_ROOM,
          paddingBottom: OVERDRAG_ROOM,
          backgroundColor: colors.surfaceElevated,
        },
        sheetStyle,
      ]}
    >
      {scrollable ? <GestureDetector gesture={pan}>{header}</GestureDetector> : header}
      {body}
    </Animated.View>
  )

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismissible ? requestDismiss : undefined}
    >
      <GestureHandlerRootView style={styles.fill}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.fill}
        >
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimStyle]}>
            <Pressable
              style={styles.fill}
              onPress={dismissible ? requestDismiss : undefined}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          </Animated.View>
          {scrollable ? sheetSurface : <GestureDetector gesture={pan}>{sheetSurface}</GestureDetector>}
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -OVERDRAG_ROOM,
    borderTopLeftRadius: KitLayout.sheetRadius,
    borderTopRightRadius: KitLayout.sheetRadius,
    borderCurve: "continuous",
    paddingHorizontal: KitLayout.screenGutter,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 16,
  },
  header: { paddingTop: PlayTTSpacing.xs, paddingBottom: PlayTTSpacing.sm },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: PlayTTSpacing.sm,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.sm },
  title: { flex: 1 },
  close: { justifyContent: "center", alignItems: "flex-end", paddingLeft: PlayTTSpacing.xs },
  scroll: { flex: 1 },
})
