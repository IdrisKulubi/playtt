import type { ComponentProps } from "react"
import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

type EmptyStateProps = {
  icon: ComponentProps<typeof IconSymbol>["name"]
  /** What's missing, in plain words: "No games booked yet". */
  title: string
  /** One sentence on what to do next. */
  message?: string
  /** Every empty state offers a next step. */
  action: { label: string; onPress: () => void }
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const { colors } = useAppTheme()

  return (
    <View style={styles.root}>
      <View style={[styles.iconWrap, { backgroundColor: colors.fill }]}>
        <IconSymbol name={icon} size={36} color={colors.accentText} />
      </View>
      <AppText variant="title3" style={styles.center} accessibilityRole="header">
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" color="secondaryLabel" style={styles.center}>
          {message}
        </AppText>
      ) : null}
      <Button label={action.label} onPress={action.onPress} fullWidth={false} style={styles.action} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    paddingVertical: PlayTTSpacing.xl,
    paddingHorizontal: PlayTTSpacing.lg,
    gap: PlayTTSpacing.sm,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: PlayTTSpacing.xs,
  },
  center: { textAlign: "center" },
  action: { alignSelf: "center", marginTop: PlayTTSpacing.xs },
})
