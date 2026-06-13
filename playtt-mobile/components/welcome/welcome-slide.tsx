import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"

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

export function WelcomeSlide({ slide, width }: WelcomeSlideProps) {
  return (
    <View style={[styles.container, { width }]}>
      <Text style={styles.headline}>{slide.headline}</Text>
      <View style={styles.illustration}>{slide.illustration}</View>
      <Text style={styles.body}>{slide.body}</Text>
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
  headline: {
    ...PlayTTTypography.headline,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
    textAlign: "center",
  },
  illustration: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  body: {
    ...PlayTTTypography.body,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
    textAlign: "center",
    maxWidth: 320,
  },
})
