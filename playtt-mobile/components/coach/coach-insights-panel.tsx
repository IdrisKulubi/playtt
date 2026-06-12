import { router } from "expo-router"
import { useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { CoachInsightDetailSheet } from "@/components/coach/coach-insight-detail-sheet"
import { Button } from "@/components/ui/button"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { CoachInsight, CoachStatus } from "@/lib/coach-types"

type CoachInsightsPanelProps = {
  insights: CoachInsight[]
  status: CoachStatus
}

export function CoachInsightsPanel({
  insights,
  status,
}: CoachInsightsPanelProps) {
  const theme = useProductTheme()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = insights.find((item) => item.id === selectedId) ?? null

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.md,
        },
        empty: {
          gap: PlayTTSpacing.sm,
        },
        emptyText: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 22,
        },
        card: {
          gap: PlayTTSpacing.xs,
          paddingVertical: PlayTTSpacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        pressed: {
          opacity: 0.7,
        },
        meta: {
          fontSize: 12,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        },
        title: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        summary: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 20,
        },
      }),
    [theme],
  )

  if (!status.isActive) {
    return (
      <Text style={styles.emptyText}>
        Subscribe to Coach to see insights from your captured clips.
      </Text>
    )
  }

  if (insights.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Play a session and capture a clip. Your first insight will appear
          here.
        </Text>
        <Button
          label="View Activity"
          variant="outline"
          surface="product"
          productTheme={theme}
          onPress={() => router.push("/(app)/(tabs)/activity")}
        />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {insights.map((insight) => (
        <Pressable
          key={insight.id}
          onPress={() => setSelectedId(insight.id)}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <Text style={styles.meta}>{insight.replayTitle}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {insight.focusAreas.join(" · ")}
          </Text>
          <Text style={styles.summary} numberOfLines={3}>
            {insight.summary}
          </Text>
        </Pressable>
      ))}

      <CoachInsightDetailSheet
        insight={selected}
        visible={selected !== null}
        onClose={() => setSelectedId(null)}
      />
    </View>
  )
}
