import { useEffect, useMemo, useRef, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { CaretDownIcon } from "phosphor-react-native/src/icons/CaretDown"
import { CaretLeftIcon } from "phosphor-react-native/src/icons/CaretLeft"
import { CaretRightIcon } from "phosphor-react-native/src/icons/CaretRight"
import { ExportIcon } from "phosphor-react-native/src/icons/Export"
import { CalendarBlankIcon } from "phosphor-react-native/src/icons/CalendarBlank"
import { StatsShareSheet } from "@/components/activity/stats-share-sheet"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { GlassPanel } from "@/components/ui/glass-panel"
import { GlassSegmentControl } from "@/components/ui/glass-segment-control"
import { PreviewBadge } from "@/components/ui/preview-badge"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton/skeleton"
import { PlayTTColors, PlayTTFontFamilies } from "@/constants/playtt-tokens"
import { useProductTheme, useSkeletonSurface } from "@/hooks/use-product-theme"
import {
  fetchActivityStats,
  type ActivityStats,
  type StatsPeriod,
  type StatsSession,
} from "@/lib/activity-stats-api"
import { USE_LIVE_PLAYER_STATS } from "@/lib/mock/mock-config"
import { sampleActivityStats } from "@/lib/mock/mock-activity-stats"

type Metric = "minutes" | "sessions" | "spendKes"
const metrics: { key: Metric; label: string }[] = [
  { key: "minutes", label: "Table time" },
  { key: "sessions", label: "Sessions" },
  { key: "spendKes", label: "Spending" },
]
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`
}
function parseDate(value: string) {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}
export function shiftStatsDate(
  date: string,
  period: StatsPeriod,
  direction: number
) {
  const d = parseDate(date)
  return dateKey(
    period === "year"
      ? new Date(d.getFullYear() + direction, 0, 1)
      : period === "month"
        ? new Date(d.getFullYear(), d.getMonth() + direction, 1)
        : new Date(d.getFullYear(), d.getMonth(), d.getDate() + direction)
  )
}
function timeLabel(minutes: number) {
  const rounded = Math.round(minutes),
    hours = Math.floor(rounded / 60),
    rest = rounded % 60
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`
}
function money(value: number) {
  return `KES ${Math.round(value).toLocaleString("en-KE")}`
}
function metricValue(key: Metric, value: number) {
  return key === "minutes"
    ? timeLabel(value)
    : key === "spendKes"
      ? money(value)
      : value.toLocaleString("en-KE")
}
function sessionDate(s: StatsSession) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(s.startTime))
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`
}
function sessionHour(s: StatsSession) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(s.startTime))
  )
}

export function PlayerStatsPanel() {
  const theme = useProductTheme(),
    surface = useSkeletonSurface()
  const [period, setPeriod] = useState<StatsPeriod>("month"),
    [date, setDate] = useState(todayKey)
  const [metric, setMetric] = useState<Metric>("minutes")
  const [result, setResult] = useState<{
      key: string
      data?: ActivityStats
      error?: boolean
    } | null>(null),
    [retry, setRetry] = useState(0)
  const requestKey = `${period}-${date}-${retry}`,
    data = result?.key === requestKey ? (result.data ?? null) : null,
    loading = result?.key !== requestKey,
    error = result?.key === requestKey && result.error
  const [selected, setSelected] = useState<number | null>(null),
    [detailOpen, setDetailOpen] = useState(false),
    [shareOpen, setShareOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false),
    [pickerYear, setPickerYear] = useState(Number(date.slice(0, 4))),
    [pickerMonth, setPickerMonth] = useState(Number(date.slice(5, 7)) - 1)
  const chartRef = useRef<ScrollView>(null),
    current = todayKey()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { gap: 20 },
        row: {
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        },
        title: {
          flexShrink: 1,
          fontFamily: PlayTTFontFamilies.semiBold,
          fontSize: 20,
          color: theme.foreground,
          letterSpacing: -0.3,
        },
        body: {
          flexShrink: 1,
          fontFamily: PlayTTFontFamilies.regular,
          fontSize: 14,
          lineHeight: 21,
          color: theme.muted,
        },
        label: {
          fontFamily: PlayTTFontFamilies.medium,
          fontSize: 12,
          color: theme.muted,
        },
        value: {
          fontFamily: PlayTTFontFamilies.semiBold,
          fontSize: 24,
          color: theme.foreground,
          fontVariant: ["tabular-nums"],
          letterSpacing: -0.4,
        },
        button: {
          minHeight: 44,
          minWidth: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
        },
        periodTitle: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 44,
          flex: 1,
          justifyContent: "center",
        },
        panel: { borderRadius: 16 },
        panelContent: { gap: 20, padding: 20 },
        metricRow: { flexDirection: "row", gap: 4 },
        metric: {
          flex: 1,
          paddingVertical: 10,
          paddingHorizontal: 4,
          borderBottomWidth: 2,
          borderBottomColor: "transparent",
          gap: 8,
        },
        metricActive: { borderBottomColor: PlayTTColors.primary },
        metricValue: {
          fontFamily: PlayTTFontFamilies.semiBold,
          fontSize: 20,
          color: theme.foreground,
          fontVariant: ["tabular-nums"],
        },
        graph: { height: 190, position: "relative" },
        grid: {
          position: "absolute",
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: theme.border,
        },
        columns: {
          flexDirection: "row",
          alignItems: "flex-end",
          paddingTop: 20,
        },
        column: {
          width: 44,
          minHeight: 164,
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 10,
          paddingBottom: 4,
        },
        bar: {
          width: 20,
          borderTopLeftRadius: 5,
          borderTopRightRadius: 5,
          backgroundColor: theme.muted,
          opacity: 0.45,
        },
        selectedBar: { backgroundColor: PlayTTColors.primary, opacity: 1 },
        columnLabel: {
          fontFamily: PlayTTFontFamilies.medium,
          fontSize: 11,
          color: theme.muted,
        },
        selectedLabel: {
          color: theme.foreground,
          fontFamily: PlayTTFontFamilies.semiBold,
        },
        chartTop: {
          fontFamily: PlayTTFontFamilies.regular,
          fontSize: 11,
          color: theme.muted,
        },
        selectedSummary: {
          gap: 12,
          paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
        },
        link: {
          color: theme.foreground,
          fontFamily: PlayTTFontFamilies.semiBold,
          fontSize: 14,
        },
        summary: { gap: 16 },
        summaryRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: 12,
          gap: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        summaryNumber: {
          flexShrink: 1,
          textAlign: "right",
          fontFamily: PlayTTFontFamilies.semiBold,
          fontSize: 16,
          color: theme.foreground,
          fontVariant: ["tabular-nums"],
        },
        share: {
          backgroundColor: PlayTTColors.primary,
          borderRadius: 20,
          minHeight: 52,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: 12,
        },
        shareText: {
          fontFamily: PlayTTFontFamilies.semiBold,
          fontSize: 15,
          color: PlayTTColors.primaryForeground,
        },
        sheet: { gap: 20 },
        session: {
          gap: 7,
          paddingVertical: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        sessionTitle: {
          flexShrink: 1,
          fontFamily: PlayTTFontFamilies.semiBold,
          fontSize: 16,
          color: theme.foreground,
        },
        badge: { alignSelf: "flex-start" },
        empty: { gap: 12, paddingVertical: 20 },
        pickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
        pickerCell: {
          width: "30%",
          flexGrow: 1,
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          backgroundColor: theme.elevated,
        },
        dayCell: {
          width: "12%",
          minHeight: 44,
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
        },
        pickerSelected: { backgroundColor: theme.border },
        disabled: { opacity: 0.3 },
        error: {
          gap: 12,
          padding: 20,
          backgroundColor: theme.elevated,
          borderRadius: 16,
        },
        footnote: {
          fontFamily: PlayTTFontFamilies.regular,
          fontSize: 12,
          lineHeight: 18,
          color: theme.muted,
        },
        change: {
          fontFamily: PlayTTFontFamilies.medium,
          fontSize: 13,
          color: theme.foreground,
          lineHeight: 19,
        },
        chip: {
          backgroundColor: theme.elevated,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          minHeight: 44,
        },
        dateList: { gap: 12 },
      }),
    [theme]
  )
  useEffect(() => {
    let active = true
    const request = USE_LIVE_PLAYER_STATS
      ? fetchActivityStats(period, date)
      : Promise.resolve(sampleActivityStats(period, date))
    void request
      .then((result) => {
        if (active) {
          setResult({ key: requestKey, data: result })
          let index = result.buckets.length - 1
          while (index > 0 && !result.buckets[index].sessions) index--
          setSelected(index)
        }
      })
      .catch(() => {
        if (active) setResult({ key: requestKey, error: true })
      })
    return () => {
      active = false
    }
  }, [period, date, retry, requestKey])
  useEffect(() => {
    if (selected !== null)
      chartRef.current?.scrollTo({
        x: Math.max(0, selected * 44 - 132),
        animated: false,
      })
  }, [selected])
  const previousDate = shiftStatsDate(date, period, -1),
    canPrevious = previousDate >= "2000-01-01"
  const nextDate = shiftStatsDate(date, period, 1)
  const canNext =
    period === "year"
      ? nextDate.slice(0, 4) <= current.slice(0, 4)
      : period === "month"
        ? nextDate.slice(0, 7) <= current.slice(0, 7)
        : nextDate <= current
  const periodLabel =
    data?.label ??
    parseDate(date).toLocaleDateString(
      "en-KE",
      period === "year"
        ? { year: "numeric" }
        : period === "month"
          ? { month: "long", year: "numeric" }
          : { day: "numeric", month: "long", year: "numeric" }
    )
  const bucket = selected !== null ? data?.buckets[selected] : null
  const max = data ? Math.max(...data.buckets.map((b) => b[metric]), 1) : 1
  const detailSessions = data
    ? data.sessions.filter(
        (s) =>
          !bucket ||
          (period === "year"
            ? sessionDate(s).slice(0, 7) === bucket.date.slice(0, 7)
            : period === "month"
              ? sessionDate(s) === bucket.date.slice(0, 10)
              : sessionHour(s) === selected)
      )
    : []
  const detailTitle = bucket
    ? period === "year"
      ? parseDate(bucket.date).toLocaleDateString("en-KE", {
          month: "long",
          year: "numeric",
        })
      : period === "month"
        ? parseDate(bucket.date).toLocaleDateString("en-KE", {
            day: "numeric",
            month: "long",
          })
        : `${bucket.label} · ${periodLabel}`
    : periodLabel
  const previous = data?.previous.totals[metric] ?? 0,
    difference = data ? data.totals[metric] - previous : 0
  const comparison = !data
    ? ""
    : !previous
      ? data.totals[metric]
        ? `Activity recorded this ${period}; none in ${data.previous.label}`
        : "No activity in either period"
      : !difference
        ? `Same as ${data.previous.label}`
        : `${metricValue(metric, Math.abs(difference))} ${difference > 0 ? "more" : "less"} than ${data.previous.label}`
  function chooseDate(value: string) {
    setDate(value)
    setPickerOpen(false)
  }
  function drillDown() {
    if (bucket) {
      setDetailOpen(false)
      setDate(bucket.date.slice(0, 10))
      setPeriod(period === "year" ? "month" : "day")
    }
  }
  function selectPeriod(next: StatsPeriod) {
    setDate((d) =>
      next === "year"
        ? `${d.slice(0, 4)}-01-01`
        : next === "month"
          ? `${d.slice(0, 7)}-01`
          : d
    )
    setPeriod(next)
  }
  return (
    <View style={styles.root}>
      <GlassSegmentControl
        value={period}
        options={[
          { value: "year", label: "Year" },
          { value: "month", label: "Month" },
          { value: "day", label: "Day" },
        ]}
        onChange={selectPeriod}
      />
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Previous ${period}`}
          disabled={!canPrevious}
          accessibilityState={{ disabled: !canPrevious }}
          onPress={() => setDate(previousDate)}
          style={[styles.button, !canPrevious && styles.disabled]}
        >
          <CaretLeftIcon size={20} color={theme.foreground} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choose ${period}, ${periodLabel}`}
          onPress={() => {
            setPickerYear(Number(date.slice(0, 4)))
            setPickerMonth(Number(date.slice(5, 7)) - 1)
            setPickerOpen(true)
          }}
          style={styles.periodTitle}
        >
          <Text style={styles.title}>{periodLabel}</Text>
          <CaretDownIcon size={16} color={theme.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Next ${period}`}
          accessibilityState={{ disabled: !canNext }}
          disabled={!canNext}
          onPress={() => setDate(nextDate)}
          style={[styles.button, !canNext && styles.disabled]}
        >
          <CaretRightIcon size={20} color={theme.foreground} />
        </Pressable>
      </View>
      {loading ? (
        <SkeletonGroup gap="lg">
          <Skeleton width="100%" height={78} surface={surface} />
          <Skeleton width="100%" height={230} surface={surface} />
          <Skeleton width="100%" height={120} surface={surface} />
        </SkeletonGroup>
      ) : error ? (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <Text style={styles.title}>Stats couldn’t load</Text>
          <Text style={styles.body}>Check your connection and try again.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRetry((r) => r + 1)}
            style={styles.chip}
          >
            <Text style={styles.link}>Try again</Text>
          </Pressable>
        </View>
      ) : data ? (
        <>
          <GlassPanel style={styles.panel} contentStyle={styles.panelContent}>
            <View style={styles.metricRow}>
              {metrics.map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label}: ${metricValue(item.key, data.totals[item.key])}`}
                  accessibilityState={{ selected: metric === item.key }}
                  style={[
                    styles.metric,
                    metric === item.key && styles.metricActive,
                  ]}
                  onPress={() => setMetric(item.key)}
                >
                  <Text style={styles.label}>{item.label}</Text>
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    numberOfLines={1}
                    style={styles.metricValue}
                  >
                    {metricValue(item.key, data.totals[item.key])}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.change}>{comparison}</Text>
            <View style={styles.graph}>
              {[24, 88, 152].map((top) => (
                <View key={top} style={[styles.grid, { top }]} />
              ))}
              <Text style={styles.chartTop}>
                {metricValue(
                  metric,
                  data.buckets.some((b) => b[metric]) ? max : 0
                )}
                {metric === "minutes" ? " booked" : ""}
              </Text>
              <ScrollView
                ref={chartRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.columns}
                onContentSizeChange={() =>
                  chartRef.current?.scrollTo({
                    x: Math.max(0, (selected ?? 0) * 44 - 132),
                    animated: false,
                  })
                }
              >
                {data.buckets.map((item, index) => (
                  <Pressable
                    key={`${item.date}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.label}: ${metricValue(metric, item[metric])}. Show details`}
                    accessibilityState={{ selected: index === selected }}
                    onPress={() => setSelected(index)}
                    style={styles.column}
                  >
                    <View
                      style={[
                        styles.bar,
                        {
                          height: item[metric]
                            ? Math.max(5, (item[metric] / max) * 128)
                            : 2,
                        },
                        index === selected && styles.selectedBar,
                      ]}
                    />
                    <Text
                      style={[
                        styles.columnLabel,
                        index === selected && styles.selectedLabel,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <Text style={styles.footnote}>
              Swipe the chart. Tap a{" "}
              {period === "year"
                ? "month"
                : period === "month"
                  ? "day"
                  : "time"}{" "}
              to explore.
            </Text>
            {bucket ? (
              <View style={styles.selectedSummary}>
                <View style={styles.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.label}>{detailTitle}</Text>
                    <Text style={styles.value}>
                      {metricValue(metric, bucket[metric])}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View sessions for ${detailTitle}`}
                    onPress={() => setDetailOpen(true)}
                    style={styles.chip}
                  >
                    <Text style={styles.link}>Details</Text>
                  </Pressable>
                </View>
                <Text style={styles.body}>
                  {bucket.sessions}{" "}
                  {bucket.sessions === 1 ? "session" : "sessions"} ·{" "}
                  {timeLabel(bucket.minutes)} booked · {money(bucket.spendKes)}{" "}
                  paid
                </Text>
              </View>
            ) : null}
            {!data.totals.bookings ? (
              <View style={styles.empty}>
                <CalendarBlankIcon size={24} color={theme.muted} />
                <Text style={styles.sessionTitle}>
                  Room for your next session
                </Text>
                <Text style={styles.body}>
                  No bookings in this {period}. Try another period, or book a
                  table to start your story.
                </Text>
              </View>
            ) : null}
          </GlassPanel>
          <View style={styles.summary}>
            <Text style={styles.title}>The details</Text>
            <View>
              <View style={styles.summaryRow}>
                <Text style={styles.body}>Average session</Text>
                <Text style={styles.summaryNumber}>
                  {timeLabel(data.totals.averageMinutes)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.body}>Average paid per booking</Text>
                <Text style={styles.summaryNumber}>
                  {money(data.totals.averageSpendKes)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View all ${data.totals.bookings} bookings`}
                onPress={() => {
                  setSelected(null)
                  setDetailOpen(true)
                }}
                style={styles.summaryRow}
              >
                <Text style={styles.body}>All bookings</Text>
                <View style={styles.row}>
                  <Text style={styles.summaryNumber}>
                    {data.totals.bookings}
                  </Text>
                  <CaretRightIcon size={16} color={theme.muted} />
                </View>
              </Pressable>
              <View style={styles.summaryRow}>
                <Text style={styles.body}>Cancelled bookings</Text>
                <Text style={styles.summaryNumber}>
                  {data.totals.cancelledSessions}
                </Text>
              </View>
            </View>
            <Text style={styles.footnote}>
              Table time is the reserved duration of past sessions, not measured
              playing time. All dates use Nairobi time.
            </Text>
            {data.notes.map((note) => (
              <Text key={note} style={styles.footnote}>
                {note}
              </Text>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a branded stats image"
            onPress={() => setShareOpen(true)}
            style={styles.share}
          >
            <ExportIcon size={20} color={PlayTTColors.primaryForeground} />
            <Text style={styles.shareText}>Share your table story</Text>
          </Pressable>
          {!USE_LIVE_PLAYER_STATS ? (
            <View style={styles.badge}>
              <PreviewBadge label="Sample" />
            </View>
          ) : null}
          <StatsShareSheet
            visible={shareOpen}
            onClose={() => setShareOpen(false)}
            data={{
              periodLabel: data.label,
              sessions: data.totals.sessions,
              minutes: data.totals.minutes,
              spendingKes: data.totals.spendKes,
              preview: !USE_LIVE_PLAYER_STATS,
            }}
          />
        </>
      ) : null}
      <BottomSheet
        visible={detailOpen}
        title={detailTitle}
        onClose={() => setDetailOpen(false)}
        scrollable
      >
        <View style={styles.sheet}>
          {!USE_LIVE_PLAYER_STATS ? (
            <View style={styles.badge}>
              <PreviewBadge label="Sample" />
            </View>
          ) : null}
          {bucket && period !== "day" ? (
            <Pressable
              accessibilityRole="button"
              onPress={drillDown}
              style={[styles.chip, styles.row]}
            >
              <Text style={styles.link}>
                Explore this {period === "year" ? "month" : "day"}
              </Text>
              <CaretRightIcon size={18} color={theme.foreground} />
            </Pressable>
          ) : null}
          {detailSessions.length ? (
            detailSessions.map((session) => (
              <View key={session.id} style={styles.session}>
                <View style={styles.row}>
                  <Text style={styles.sessionTitle}>
                    {session.locationName}
                  </Text>
                  <Text style={styles.summaryNumber}>
                    {new Intl.NumberFormat("en-KE", {
                      style: "currency",
                      currency: session.currency,
                      maximumFractionDigits: 0,
                    }).format(session.totalKes)}
                  </Text>
                </View>
                <Text style={styles.body}>
                  {new Date(session.startTime).toLocaleString("en-KE", {
                    timeZone: "Africa/Nairobi",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  · {timeLabel(session.durationMinutes)} reserved
                </Text>
                <Text style={styles.footnote}>
                  {session.resourceName} · {session.status.replaceAll("_", " ")}{" "}
                  · {session.paymentStatus.replaceAll("_", " ")} � reservation
                  price
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.empty}>
              <Text style={styles.sessionTitle}>No sessions here</Text>
              <Text style={styles.body}>
                Pick another {period === "year" ? "month" : "day"} in the chart
                to see your bookings.
              </Text>
            </View>
          )}
          <Text style={styles.footnote}>
            Prices are per reservation. Spending counts successful payments;
            cancelled reservations don’t count toward table time.
          </Text>
          {metric === "spendKes"
            ? data?.notes.map((note) => (
                <Text key={note} style={styles.footnote}>
                  {note}
                </Text>
              ))
            : null}
        </View>
      </BottomSheet>
      <BottomSheet
        visible={pickerOpen}
        title={`Choose a ${period}`}
        onClose={() => setPickerOpen(false)}
        scrollable
      >
        <View style={styles.dateList}>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous year"
              disabled={pickerYear <= 2000}
              accessibilityState={{ disabled: pickerYear <= 2000 }}
              onPress={() => setPickerYear((y) => y - 1)}
              style={[styles.button, pickerYear <= 2000 && styles.disabled]}
            >
              <CaretLeftIcon size={20} color={theme.foreground} />
            </Pressable>
            <Text style={styles.title}>{pickerYear}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next year"
              disabled={pickerYear >= Number(current.slice(0, 4))}
              style={[
                styles.button,
                pickerYear >= Number(current.slice(0, 4)) && styles.disabled,
              ]}
              onPress={() => setPickerYear((y) => y + 1)}
            >
              <CaretRightIcon size={20} color={theme.foreground} />
            </Pressable>
          </View>
          {period === "year" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => chooseDate(`${pickerYear}-01-01`)}
              style={styles.share}
            >
              <Text style={styles.shareText}>View {pickerYear}</Text>
            </Pressable>
          ) : (
            <View style={styles.pickerGrid}>
              {Array.from({ length: 12 }, (_, month) => {
                const key = `${pickerYear}-${String(month + 1).padStart(2, "0")}-01`,
                  disabled = key.slice(0, 7) > current.slice(0, 7)
                return (
                  <Pressable
                    key={month}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: pickerMonth === month,
                      disabled,
                    }}
                    disabled={disabled}
                    style={[
                      styles.pickerCell,
                      pickerMonth === month && styles.pickerSelected,
                      disabled && styles.disabled,
                    ]}
                    onPress={() =>
                      period === "month"
                        ? chooseDate(key)
                        : setPickerMonth(month)
                    }
                  >
                    <Text style={styles.link}>
                      {new Date(pickerYear, month, 1).toLocaleDateString(
                        "en-KE",
                        { month: "short" }
                      )}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )}
          {period === "day" ? (
            <>
              <Text style={styles.title}>
                {new Date(pickerYear, pickerMonth, 1).toLocaleDateString(
                  "en-KE",
                  { month: "long" }
                )}
              </Text>
              <View style={styles.pickerGrid}>
                {Array.from(
                  {
                    length: new Date(pickerYear, pickerMonth + 1, 0).getDate(),
                  },
                  (_, index) => {
                    const key = dateKey(
                        new Date(pickerYear, pickerMonth, index + 1)
                      ),
                      disabled = key > current
                    return (
                      <Pressable
                        key={key}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${key}`}
                        accessibilityState={{
                          disabled,
                          selected: key === date,
                        }}
                        disabled={disabled}
                        style={[
                          styles.dayCell,
                          key === date && styles.pickerSelected,
                          disabled && styles.disabled,
                        ]}
                        onPress={() => chooseDate(key)}
                      >
                        <Text style={styles.link}>{index + 1}</Text>
                      </Pressable>
                    )
                  }
                )}
              </View>
            </>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => chooseDate(current)}
            style={styles.chip}
          >
            <Text style={styles.link}>Back to this {period}</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  )
}
