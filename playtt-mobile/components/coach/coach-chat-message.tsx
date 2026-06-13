import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { CoachChatMessage } from "@/lib/mock/mock-coach-chat"

type CoachChatMessageBubbleProps = {
  message: CoachChatMessage
}

export function CoachChatMessageBubble({ message }: CoachChatMessageBubbleProps) {
  const theme = useProductTheme()
  const isCoach = message.role === "coach"

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          justifyContent: isCoach ? "flex-start" : "flex-end",
          paddingHorizontal: PlayTTSpacing.xl,
          marginBottom: PlayTTSpacing.sm,
        },
        bubble: {
          maxWidth: "82%",
          borderRadius: 18,
          paddingHorizontal: PlayTTSpacing.md,
          paddingVertical: PlayTTSpacing.sm,
          backgroundColor: isCoach ? theme.elevated : "rgba(0, 183, 255, 0.14)",
          borderWidth: isCoach ? StyleSheet.hairlineWidth : 0,
          borderColor: theme.border,
        },
        label: {
          fontSize: 11,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.muted,
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        },
        text: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.foreground,
          lineHeight: 22,
        },
      }),
    [isCoach, theme],
  )

  return (
    <View style={styles.row}>
      <View style={styles.bubble}>
        {isCoach ? <Text style={styles.label}>Coach</Text> : null}
        <Text style={styles.text}>{message.text}</Text>
      </View>
    </View>
  )
}
