import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"

import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

type AccountGlassSectionProps = {
  title?: string
  description?: string
  children: ReactNode
}

/**
 * Grouped section for Me sub-screens. Despite the old name it is now a solid
 * surface: glass is for floating chrome only, never content.
 */
export function AccountGlassSection({ title, description, children }: AccountGlassSectionProps) {
  const { colors } = useAppTheme()

  return (
    <View style={styles.section}>
      {title ? (
        <AppText variant="footnote" color="secondaryLabel" accessibilityRole="header" style={styles.label}>
          {title}
        </AppText>
      ) : null}
      {description ? (
        <AppText variant="footnote" color="secondaryLabel" style={styles.label}>
          {description}
        </AppText>
      ) : null}
      <View style={[styles.group, { backgroundColor: colors.surface }]}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: PlayTTSpacing.xs },
  label: { paddingHorizontal: PlayTTSpacing.md },
  group: {
    borderRadius: KitLayout.groupRadius,
    borderCurve: "continuous",
    overflow: "hidden",
  },
})
