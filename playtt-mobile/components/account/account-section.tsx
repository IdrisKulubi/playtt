import { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"

type AccountSectionProps = {
  title: string
  children: ReactNode
}

export function AccountSection({ title, children }: AccountSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.rows}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: PlayTTSpacing.sm,
  },
  title: {
    fontSize: 12,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.mutedText,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  rows: {
    gap: 0,
  },
})
