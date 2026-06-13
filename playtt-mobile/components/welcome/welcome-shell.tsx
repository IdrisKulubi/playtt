import type { ReactNode } from "react"
import { StyleSheet, useWindowDimensions, View } from "react-native"
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg"
import { SafeAreaView } from "react-native-safe-area-context"

import { PlayTTColors, PlayTTSpacing } from "@/constants/playtt-tokens"

type WelcomeShellProps = {
  header?: ReactNode
  footer: ReactNode
  children: ReactNode
}

function DiagonalBackground({ width, height }: { width: number; height: number }) {
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="azureGlow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={PlayTTColors.background} stopOpacity="1" />
          <Stop offset="0.55" stopColor={PlayTTColors.background} stopOpacity="1" />
          <Stop offset="0.72" stopColor="#0a3d5c" stopOpacity="1" />
          <Stop offset="1" stopColor="#0066aa" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Path d={`M 0 0 H ${width} V ${height} H 0 Z`} fill="url(#azureGlow)" />
      <Path
        d={`M 0 ${height * 0.58} L ${width} ${height * 0.42} L ${width} ${height * 0.48} L 0 ${height * 0.64} Z`}
        fill="rgba(0, 183, 255, 0.08)"
      />
    </Svg>
  )
}

export function WelcomeShell({ header, footer, children }: WelcomeShellProps) {
  const { width, height } = useWindowDimensions()

  return (
    <View style={styles.root}>
      <DiagonalBackground width={width} height={height} />
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
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: PlayTTSpacing.xl,
    paddingTop: PlayTTSpacing.xs,
    alignItems: "flex-end",
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: PlayTTSpacing.xl,
    paddingBottom: PlayTTSpacing.lg,
    gap: PlayTTSpacing.md,
  },
})
