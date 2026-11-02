import { type ComponentProps, useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"

import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PreviewBadge } from "@/components/ui/preview-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useSkeletonSurface } from "@/hooks/use-product-theme"
import { type ActivityStats, fetchActivityStats } from "@/lib/activity-stats-api"
import { sampleActivityStats } from "@/lib/mock/mock-activity-stats"
import { MOCK_SAMPLE_LABEL, USE_LIVE_PLAYER_STATS } from "@/lib/mock/mock-config"
import { toDateKey } from "@/lib/booking-utils"

type Trend = { delta: number; unit: string }

function Stat({ value, label, trend }: { value: string; label: string; trend?: Trend }) {
  const { colors } = useAppTheme()
  const up = trend && trend.delta > 0
  const down = trend && trend.delta < 0
  const trendIcon: ComponentProps<typeof IconSymbol>["name"] = up ? "arrow.up" : "arrow.down"
  const trendWords = trend
    ? trend.delta === 0
      ? "Same as last month"
      : `${up ? "+" : "−"}${Math.abs(trend.delta)} ${trend.unit} vs last month`
    : null

  return (
    <View style={styles.stat} accessible accessibilityLabel={[`${value} ${label}`, trendWords].filter(Boolean).join(", ")}>
      <AppText variant="title1" tabular>
        {value}
      </AppText>
      <AppText variant="footnote" color="secondaryLabel">
        {label}
      </AppText>
      {trend && trend.delta !== 0 ? (
        <View style={styles.trend}>
          <IconSymbol name={trendIcon} size={12} color={up ? colors.success : colors.secondaryLabel} />
          <AppText variant="caption" color={up ? "success" : "secondaryLabel"} tabular>
            {`${up ? "+" : down ? "−" : ""}${Math.abs(trend.delta)}`}
          </AppText>
        </View>
      ) : null}
    </View>
  )
}

/** This month at a glance: three big numbers, each with a word and a trend. */
export function ProgressStatsCard() {
  const skeletonSurface = useSkeletonSurface()
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let mounted = true
    const today = toDateKey(new Date())

    async function load() {
      try {
        const data = USE_LIVE_PLAYER_STATS
          ? await fetchActivityStats("month", today)
          : sampleActivityStats("month", today)
        if (mounted) setStats(data)
      } catch {
        if (mounted) setFailed(true)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [])

  if (failed) {
    return (
      <Card>
        <AppText variant="body" color="secondaryLabel">
          Your numbers couldn&apos;t load. Pull down to try again.
        </AppText>
      </Card>
    )
  }

  if (!stats) return <Skeleton surface={skeletonSurface} height={132} borderRadius={20} />

  const { totals, previous } = stats
  const hours = Math.round((totals.minutes / 60) * 10) / 10
  const previousHours = Math.round((previous.totals.minutes / 60) * 10) / 10

  return (
    <Card>
      <View style={styles.header}>
        <AppText variant="headline">{stats.label}</AppText>
        {!USE_LIVE_PLAYER_STATS ? <PreviewBadge label={MOCK_SAMPLE_LABEL} /> : null}
      </View>
      <View style={styles.row}>
        <Stat
          value={String(totals.sessions)}
          label={totals.sessions === 1 ? "game played" : "games played"}
          trend={{ delta: totals.sessions - previous.totals.sessions, unit: "games" }}
        />
        <Stat
          value={String(hours)}
          label="hours on the table"
          trend={{ delta: Math.round((hours - previousHours) * 10) / 10, unit: "hours" }}
        />
        <Stat value={`${Math.round(totals.averageMinutes)}`} label="minutes a game" />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: PlayTTSpacing.sm,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: PlayTTSpacing.md },
  stat: { flexGrow: 1, flexBasis: 88, gap: 2 },
  trend: { flexDirection: "row", alignItems: "center", gap: 2 },
})
