import { ReactNode, useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { GlassPanel } from "@/components/ui/glass-panel"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

type AccountGlassSectionProps = {
  title?: string
  description?: string
  children: ReactNode
}

export function AccountGlassSection({
  title,
  description,
  children,
}: AccountGlassSectionProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          gap: PlayTTSpacing.sm,
        },
        title: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.muted,
          paddingHorizontal: PlayTTSpacing["2xs"],
        },
        description: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          paddingHorizontal: PlayTTSpacing["2xs"],
          marginTop: -PlayTTSpacing["2xs"],
        },
        panel: {
          borderRadius: 16,
          shadowOpacity: 0,
          elevation: 0,
        },
        panelContent: {
          padding: 0,
        },
      }),
    [theme],
  )

  return (
    <View style={styles.section}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
      <GlassPanel style={styles.panel} contentStyle={styles.panelContent}>{children}</GlassPanel>
    </View>
  )
}
