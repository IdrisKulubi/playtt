import { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"

type AccountSectionProps = {
  title: string
  description?: string
  children?: ReactNode
}

export function AccountSection({
  title,
  description,
  children,
}: AccountSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
      {children ? <View style={styles.rows}>{children}</View> : null}
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
  description: {
    fontSize: 13,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
    marginTop: -PlayTTSpacing.xs,
  },
  rows: {
    gap: 0,
  },
})
