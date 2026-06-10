import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { createActivityHeaderStyles } from "@/components/activity/activity-screen-styles"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { formatKes } from "@/lib/booking-utils"
import { MOCK_PLAYER_STATS } from "@/lib/mock/mock-player-stats"

const MAX_DOTS = 4

function MonthDotRow({
  month,
  count,
  maxCount,
}: {
  month: string
  count: number
  maxCount: number
}) {
  const theme = useProductTheme()
  const dotCount = Math.min(count, MAX_DOTS)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        column: {
          flex: 1,
          alignItems: "center",
          gap: PlayTTSpacing.xs,
        },
        dots: {
          flexDirection: "row",
          gap: 4,
          minHeight: 10,
          alignItems: "center",
        },
        dot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: PlayTTColors.primary,
        },
        dotEmpty: {
          width: 8,
          height: 8,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: theme.border,
        },
        label: {
          fontSize: 11,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.muted,
        },
        count: {
          fontSize: 10,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
        },
      }),
    [theme],
  )

  return (
    <View style={styles.column}>
      <View style={styles.dots}>
        {Array.from({ length: MAX_DOTS }, (_, index) =>
          index < dotCount ? (
            <View
              key={index}
              style={[
                styles.dot,
                { opacity: 0.45 + (index / Math.max(maxCount, 1)) * 0.55 },
              ]}
            />
          ) : (
            <View key={index} style={styles.dotEmpty} />
          ),
        )}
      </View>
      <Text style={styles.label}>{month}</Text>
      <Text style={styles.count}>{count}</Text>
    </View>
  )
}

export function PlayerStatsPanel() {
  const theme = useProductTheme()
  const stats = MOCK_PLAYER_STATS
  const sharedStyles = useMemo(
    () => createActivityHeaderStyles(theme),
    [theme],
  )
  const maxMonthCount = Math.max(
    ...stats.monthlySessions.map((item) => item.count),
    1,
  )

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.lg,
        },
        monthSection: {
          gap: PlayTTSpacing.sm,
        },
        monthTitle: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
        monthRow: {
          flexDirection: "row",
          gap: PlayTTSpacing.sm,
        },
      }),
    [theme],
  )

  return (
    <View style={styles.root}>
      <View>
        <Text style={sharedStyles.leadHeadline}>
          {stats.hoursPlayed} hours on the table
        </Text>
        <Text style={sharedStyles.leadSubline}>
          {stats.sessionsPlayed} sessions
        </Text>
      </View>

      <View style={styles.monthSection}>
        <Text style={styles.monthTitle}>By month</Text>
        <View style={styles.monthRow}>
          {stats.monthlySessions.map((item) => (
            <MonthDotRow
              key={item.month}
              month={item.month}
              count={item.count}
              maxCount={maxMonthCount}
            />
          ))}
        </View>
      </View>

      <View>
        <View style={sharedStyles.hairlineRow}>
          <Text style={sharedStyles.hairlineLabel}>Peak sessions</Text>
          <Text style={sharedStyles.hairlineValue}>{stats.peakSessions}</Text>
        </View>
        <View style={[sharedStyles.hairlineRow, sharedStyles.hairlineRowLast]}>
          <Text style={sharedStyles.hairlineLabel}>Off-peak sessions</Text>
          <Text style={sharedStyles.hairlineValue}>
            {stats.offPeakSessions}
          </Text>
        </View>
      </View>

      <View style={sharedStyles.spendFooter}>
        <Text style={sharedStyles.spendLabel}>Spending</Text>
        <Text style={sharedStyles.spendValue}>
          {formatKes(String(stats.totalSpendKes), "KES")} total
        </Text>
      </View>
    </View>
  )
}
