import { StyleSheet, View } from "react-native"

import { PreviewBadge } from "@/components/ui/preview-badge"
import { Button } from "@/components/kit/button"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { PressableScale } from "@/components/kit/pressable-scale"
import { Sheet } from "@/components/kit/sheet"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import type { StatsPeriod, StatsSession } from "@/lib/activity-stats-api"
import { dateKey, timeLabel } from "@/lib/stats-dates"

type DetailSheetProps = {
  visible: boolean
  title: string
  period: StatsPeriod
  sessions: StatsSession[]
  sample: boolean
  /** Offered when a bar is selected and there is a finer period to open. */
  onDrillDown?: () => void
  notes?: string[]
  onClose: () => void
}

/** The sessions behind a bar (or the whole period). */
export function StatsDetailSheet({ visible, title, period, sessions, sample, onDrillDown, notes, onClose }: DetailSheetProps) {
  const next = period === "year" ? "month" : "day"

  return (
    <Sheet visible={visible} title={title} detents={["medium", "large"]} scrollable onClose={onClose}>
      <View style={styles.stack}>
        {sample ? <PreviewBadge label="Sample" /> : null}
        {onDrillDown ? <Button label={`Explore this ${next}`} variant="secondary" onPress={onDrillDown} /> : null}
        {sessions.length ? (
          <ListSection>
            {sessions.map((session) => (
              <ListRow
                key={session.id}
                icon="clock.fill"
                tone="neutral"
                title={session.locationName}
                subtitle={`${new Date(session.startTime).toLocaleString("en-KE", {
                  timeZone: "Africa/Nairobi",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })} · ${timeLabel(session.durationMinutes)} reserved · ${session.resourceName} · ${session.status.replaceAll("_", " ")}`}
                accessory={{
                  kind: "value",
                  value: new Intl.NumberFormat("en-KE", {
                    style: "currency",
                    currency: session.currency,
                    maximumFractionDigits: 0,
                  }).format(session.totalKes),
                }}
              />
            ))}
          </ListSection>
        ) : (
          <View style={styles.empty}>
            <AppText variant="headline">No sessions here</AppText>
            <AppText variant="subheadline" color="secondaryLabel" style={styles.centered}>
              Pick another {next} in the chart to see your bookings.
            </AppText>
          </View>
        )}
        <AppText variant="footnote" color="secondaryLabel">
          Prices are per reservation. Spending counts successful payments; cancelled reservations don’t count toward table time.
        </AppText>
        {notes?.map((note) => (
          <AppText key={note} variant="footnote" color="secondaryLabel">
            {note}
          </AppText>
        ))}
      </View>
    </Sheet>
  )
}

type PickerSheetProps = {
  visible: boolean
  period: StatsPeriod
  /** The date being viewed, "YYYY-MM-DD". */
  date: string
  today: string
  year: number
  month: number
  onYear: (year: number) => void
  onMonth: (month: number) => void
  onChoose: (date: string) => void
  onClose: () => void
}

function RoundButton({ icon, label, disabled, onPress }: { icon: "chevron.left" | "chevron.right"; label: string; disabled: boolean; onPress: () => void }) {
  const { colors } = useAppTheme()
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.round, { backgroundColor: colors.fill }]}
    >
      <IconSymbol name={icon} size={20} color={colors.accentText} />
    </PressableScale>
  )
}

/** Pick a year, a month or a day, depending on what you're looking at. */
export function StatsPickerSheet({ visible, period, date, today, year, month, onYear, onMonth, onChoose, onClose }: PickerSheetProps) {
  const { colors } = useAppTheme()
  const thisYear = Number(today.slice(0, 4))

  return (
    <Sheet visible={visible} title={`Choose a ${period}`} detents={["content"]} scrollable onClose={onClose}>
      <View style={styles.stack}>
        <View style={styles.yearRow}>
          <RoundButton icon="chevron.left" label="Previous year" disabled={year <= 2000} onPress={() => onYear(year - 1)} />
          <AppText variant="title2" tabular>
            {year}
          </AppText>
          <RoundButton icon="chevron.right" label="Next year" disabled={year >= thisYear} onPress={() => onYear(year + 1)} />
        </View>

        {period === "year" ? (
          <Button label={`View ${year}`} onPress={() => onChoose(`${year}-01-01`)} />
        ) : (
          <View style={styles.grid}>
            {Array.from({ length: 12 }, (_, index) => {
              const key = `${year}-${String(index + 1).padStart(2, "0")}-01`
              const disabled = key.slice(0, 7) > today.slice(0, 7)
              const selected = month === index
              return (
                <PressableScale
                  key={index}
                  onPress={() => (period === "month" ? onChoose(key) : onMonth(index))}
                  disabled={disabled}
                  haptic="selection"
                  accessibilityLabel={new Date(year, index, 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}
                  accessibilityState={{ selected, disabled }}
                  style={[styles.monthCell, { backgroundColor: selected ? colors.accent : colors.surface }]}
                >
                  <AppText variant="callout" weight="600" color={selected ? "onAccent" : "label"}>
                    {new Date(year, index, 1).toLocaleDateString("en-KE", { month: "short" })}
                  </AppText>
                </PressableScale>
              )
            })}
          </View>
        )}

        {period === "day" ? (
          <>
            <AppText variant="headline">
              {new Date(year, month, 1).toLocaleDateString("en-KE", { month: "long" })}
            </AppText>
            <View style={styles.grid}>
              {Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => {
                const key = dateKey(new Date(year, month, index + 1))
                const disabled = key > today
                const selected = key === date
                return (
                  <PressableScale
                    key={key}
                    onPress={() => onChoose(key)}
                    disabled={disabled}
                    accessibilityLabel={`View ${key}`}
                    accessibilityState={{ disabled, selected }}
                    style={[styles.dayCell, { backgroundColor: selected ? colors.accent : colors.surface }]}
                  >
                    <AppText variant="callout" weight="600" tabular color={selected ? "onAccent" : "label"}>
                      {index + 1}
                    </AppText>
                  </PressableScale>
                )
              })}
            </View>
          </>
        ) : null}

        <Button label={`Back to this ${period}`} variant="plain" onPress={() => onChoose(today)} />
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.md },
  empty: { alignItems: "center", gap: PlayTTSpacing.xs, paddingVertical: PlayTTSpacing.lg },
  centered: { textAlign: "center" },
  yearRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: PlayTTSpacing.xs },
  monthCell: { width: "31%", flexGrow: 1, minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dayCell: { width: "12%", flexGrow: 1, minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
})
