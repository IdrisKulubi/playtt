import { router } from "expo-router"
import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { PreviewBadge } from "@/components/ui/preview-badge"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { formatKes } from "@/lib/booking-utils"
import { MOCK_PLAYER_STATS } from "@/lib/mock/mock-player-stats"

export function StatsTeaser() {
  const theme = useProductTheme()
  const stats = MOCK_PLAYER_STATS

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 12,
          padding: PlayTTSpacing.md,
          backgroundColor: theme.card,
          gap: PlayTTSpacing.sm,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        title: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        row: {
          flexDirection: "row",
          gap: PlayTTSpacing.md,
        },
        stat: {
          flex: 1,
          gap: 2,
        },
        value: {
          fontSize: 18,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        label: {
          fontSize: 12,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
        },
        link: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
      }),
    [theme],
  )

  return (
    <Pressable
      onPress={() => router.push("/(app)/(tabs)/activity")}
      style={styles.card}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Your activity</Text>
        <PreviewBadge />
      </View>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.value}>{stats.sessionsPlayed}</Text>
          <Text style={styles.label}>Sessions</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.value}>
            {formatKes(String(stats.totalSpendKes), "KES")}
          </Text>
          <Text style={styles.label}>Total spend</Text>
        </View>
      </View>
      <Text style={styles.link}>View full stats →</Text>
    </Pressable>
  )
}
