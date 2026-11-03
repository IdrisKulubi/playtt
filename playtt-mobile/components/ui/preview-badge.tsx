import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { typeStyle } from "@/constants/type"
import { useAppTheme } from "@/hooks/use-app-theme"

type PreviewBadgeProps = {
  label?: string
}

export function PreviewBadge({ label = "Preview" }: PreviewBadgeProps) {
  const { colors } = useAppTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        badge: {
          alignSelf: "flex-start",
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.separator,
        },
        label: {
          ...typeStyle("footnote", "600"),
          color: colors.accentText,
        },
      }),
    [colors],
  )

  return (
    <View style={styles.badge}>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}
