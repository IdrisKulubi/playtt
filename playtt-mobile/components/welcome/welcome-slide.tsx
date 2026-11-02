import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"

import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"

export type WelcomeSlideData = {
  id: string
  headline: string
  body: string
  illustration: ReactNode
}

type WelcomeSlideProps = {
  slide: WelcomeSlideData
  width: number
}

/** One intro page: brand headline (Space Grotesk), picture, one plain sentence. */
export function WelcomeSlide({ slide, width }: WelcomeSlideProps) {
  return (
    <View style={[styles.container, { width }]}>
      <AppText variant="brandTitle" accessibilityRole="header" style={styles.center}>
        {slide.headline}
      </AppText>
      <View style={styles.illustration} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {slide.illustration}
      </View>
      <AppText variant="body" color="secondaryLabel" style={[styles.center, styles.body]}>
        {slide.body}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: PlayTTSpacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: PlayTTSpacing.lg,
  },
  center: { textAlign: "center" },
  illustration: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  body: { maxWidth: 340 },
})
