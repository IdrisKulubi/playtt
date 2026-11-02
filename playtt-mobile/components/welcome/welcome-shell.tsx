import { Image } from "expo-image"
import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg"

import { KitLayout } from "@/constants/kit-layout"
import { PlayTTColors, PlayTTSpacing } from "@/constants/playtt-tokens"

const VENUE_PHOTO = require("@/assets/images/playtt-hurlingham-venue.png")

type WelcomeShellProps = {
  header?: ReactNode
  footer: ReactNode
  children: ReactNode
}

/**
 * Full-bleed venue photo under a dark wash: the photo sets the mood, the wash
 * keeps every line of text readable (strongest where the buttons sit).
 */
function PhotoBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={VENUE_PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="welcomeWash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={PlayTTColors.background} stopOpacity="0.55" />
            <Stop offset="0.45" stopColor={PlayTTColors.background} stopOpacity="0.72" />
            <Stop offset="0.75" stopColor={PlayTTColors.background} stopOpacity="0.92" />
            <Stop offset="1" stopColor={PlayTTColors.background} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#welcomeWash)" />
      </Svg>
    </View>
  )
}

export function WelcomeShell({ header, footer, children }: WelcomeShellProps) {
  return (
    <View style={styles.root}>
      <PhotoBackdrop />
      <SafeAreaView style={styles.safeArea}>
        {header ? <View style={styles.header}>{header}</View> : null}
        <View style={styles.content}>{children}</View>
        <View style={styles.footer}>{footer}</View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PlayTTColors.background,
  },
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: KitLayout.screenGutter,
    paddingTop: PlayTTSpacing.xs,
    alignItems: "flex-end",
  },
  content: { flex: 1 },
  footer: {
    paddingHorizontal: PlayTTSpacing.lg,
    paddingBottom: PlayTTSpacing.lg,
    gap: PlayTTSpacing.sm,
  },
})
