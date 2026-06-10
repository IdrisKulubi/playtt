import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native"
import Animated, { FadeIn } from "react-native-reanimated"

import { Button } from "@/components/ui/button"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { formatTimeOfDayGreeting } from "@/lib/booking-utils"

type HomeHeroProps = {
  showBookCta: boolean
  onBook: () => void
  children?: ReactNode
}

export function HomeHero({ showBookCta, onBook, children }: HomeHeroProps) {
  const theme = useProductTheme()
  const greeting = formatTimeOfDayGreeting()
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
  }, [])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        band: {
          marginHorizontal: -PlayTTSpacing.xl,
          marginTop: -PlayTTSpacing.xl,
          marginBottom: PlayTTSpacing.md,
          paddingHorizontal: PlayTTSpacing.xl,
          paddingTop: PlayTTSpacing.lg,
          paddingBottom: PlayTTSpacing.xl,
          backgroundColor: theme.elevated,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          gap: PlayTTSpacing.lg,
        },
        content: {
          gap: PlayTTSpacing.xs,
        },
        greeting: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.muted,
        },
        headline: {
          ...PlayTTTypography.headline,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        tagline: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 22,
        },
        cta: {
          marginTop: PlayTTSpacing.xs,
        },
      }),
    [theme],
  )

  const headline = showBookCta
    ? "Book your next session"
    : "Your next session"

  const tagline = showBookCta
    ? "Private table tennis, on your schedule."
    : null

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(280)}
      style={styles.band}
    >
      <View style={styles.content}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.headline}>{headline}</Text>
        {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
      </View>

      {children}

      {showBookCta ? (
        <View style={styles.cta}>
          <Button
            label="Book a session"
            surface="product"
            productTheme={theme}
            onPress={onBook}
          />
        </View>
      ) : null}
    </Animated.View>
  )
}
