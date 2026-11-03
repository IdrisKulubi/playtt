import { type Href, router } from "expo-router"
import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { EdgeFade } from "@/components/kit/edge-fade"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { liquidGlassPillBorderColor } from "@/components/ui/liquid-glass-chrome"
import { LiquidGlassSurface, liquidGlassFill } from "@/components/ui/liquid-glass-surface"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

const PROGRESS_HREF = "/(app)/(tabs)/activity" as Href

/** Height of the button row; the large touch targets are 48 pt inside it. */
export const STATS_HEADER_ROW = 64
const FADE_BLEED = 56

type StatsHeaderProps = {
  title: string
  scrollY: SharedValue<number>
  onCalendar: () => void
  onShare?: () => void
}

/** A glass capsule that holds one or more round buttons. */
function GlassCapsule({ children }: { children: ReactNode }) {
  const { scheme } = useAppTheme()

  return (
    <View style={[styles.capsule, { borderColor: liquidGlassPillBorderColor(scheme) }]}>
      <LiquidGlassSurface colorScheme={scheme} style={liquidGlassFill} />
      {children}
    </View>
  )
}

function CapsuleButton({ icon, label, onPress }: { icon: "chevron.left" | "calendar" | "square.and.arrow.up"; label: string; onPress: () => void }) {
  const { colors } = useAppTheme()

  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={styles.button}>
      <IconSymbol name={icon} size={22} color={colors.label} />
    </PressableScale>
  )
}

/**
 * The stats header, as in Apple's Fitness: a round glass back button, the
 * title, and a glass capsule with calendar and share. It floats over the
 * content, which sinks under a soft fade as you scroll.
 */
export function StatsHeader({ title, scrollY, onCalendar, onShare }: StatsHeaderProps) {
  const insets = useSafeAreaInsets()
  const { scheme, colors } = useAppTheme()
  const height = insets.top + STATS_HEADER_ROW + FADE_BLEED

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 24], [0, 1], Extrapolation.CLAMP),
  }))

  return (
    <View pointerEvents="box-none" style={[styles.root, { paddingTop: insets.top }]}>
      <Animated.View pointerEvents="none" style={[styles.fade, { height }, fadeStyle]}>
        <EdgeFade edge="top" height={height} color={colors.background} scheme={scheme} />
      </Animated.View>

      <View pointerEvents="box-none" style={styles.row}>
        <GlassCapsule>
          <CapsuleButton
            icon="chevron.left"
            label="Back to Progress"
            onPress={() => (router.canGoBack() ? router.back() : router.replace(PROGRESS_HREF))}
          />
        </GlassCapsule>

        <AppText variant="title3" accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>

        <GlassCapsule>
          <CapsuleButton icon="calendar" label="Choose a date" onPress={onCalendar} />
          {onShare ? <CapsuleButton icon="square.and.arrow.up" label="Share your table story" onPress={onShare} /> : null}
        </GlassCapsule>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0 },
  fade: { position: "absolute", top: 0, left: 0, right: 0 },
  row: {
    height: STATS_HEADER_ROW,
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing.sm,
    paddingHorizontal: PlayTTSpacing.md,
  },
  title: { flex: 1 },
  capsule: {
    flexDirection: "row",
    borderRadius: 26,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  button: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
})
