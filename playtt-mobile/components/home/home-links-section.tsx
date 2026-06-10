import { router } from "expo-router"
import type { ReactNode } from "react"
import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { IconSymbol } from "@/components/ui/icon-symbol"
import { PreviewBadge } from "@/components/ui/preview-badge"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { MOCK_PLAYER_STATS } from "@/lib/mock/mock-player-stats"
import { MOCK_REPLAYS } from "@/lib/mock/mock-replays"

type HomeLinkRowProps = {
  title: string
  subtitle?: string
  onPress: () => void
  trailing?: ReactNode
  isLast?: boolean
}

function HomeLinkRow({
  title,
  subtitle,
  onPress,
  trailing,
  isLast = false,
}: HomeLinkRowProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingVertical: PlayTTSpacing.md,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        pressed: {
          opacity: 0.7,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: PlayTTSpacing.sm,
        },
        copy: {
          flex: 1,
          gap: 2,
        },
        title: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
        },
        subtitle: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
        },
        trailing: {
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.xs,
        },
      }),
    [isLast, theme],
  )

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.trailing}>
          {trailing}
          <IconSymbol name="chevron.right" size={18} color={theme.muted} />
        </View>
      </View>
    </Pressable>
  )
}

type HomeLinksSectionProps = {
  showBookAnother?: boolean
}

export function HomeLinksSection({ showBookAnother = false }: HomeLinksSectionProps) {
  const theme = useProductTheme()
  const stats = MOCK_PLAYER_STATS
  const latestReplay = MOCK_REPLAYS[0]

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginTop: PlayTTSpacing.md,
        },
        label: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: PlayTTSpacing.xs,
        },
      }),
    [theme],
  )

  return (
    <View style={styles.section}>
      <Text style={styles.label}>More</Text>

      {showBookAnother ? (
        <HomeLinkRow
          title="Book another session"
          onPress={() => router.push("/(app)/book")}
        />
      ) : null}

      <HomeLinkRow
        title="See your highlights"
        subtitle={`${stats.hoursPlayed}h on the table · ${latestReplay?.title ?? "Replays"}`}
        onPress={() => router.push("/(app)/(tabs)/activity")}
        trailing={<PreviewBadge />}
        isLast
      />
    </View>
  )
}
