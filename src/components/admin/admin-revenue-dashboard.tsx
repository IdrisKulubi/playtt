"use client"

import { useRouter } from "next/navigation"
import { useMemo, useTransition } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useAdminSearchFilter } from "@/components/admin/admin-context"
import {
  GroupedList,
  GroupedSection,
  LargeTitle,
  SegmentedControl,
  ValueRow,
} from "@/components/admin/admin-grouped"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import type { AdminRevenueByDay, AdminRevenueByVenue } from "@/server/admin/analytics-service"

const revenueChartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig

const DAY_MS = 86_400_000
// Fixed locales so server and browser render identical text (no hydration re-render).
const NUMBER_LOCALE = "en-KE"
const DATE_LOCALE = "en-GB"

function formatKes(value: number) {
  return `KES ${Math.round(value).toLocaleString(NUMBER_LOCALE)}`
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`
  return String(value)
}

// Day keys are UTC calendar dates ("2026-11-19") as returned by the database.
function dayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatDay(key: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString(DATE_LOCALE, { ...options, timeZone: "UTC" })
}

type DayPoint = { key: string; label: string; revenue: number; payments: number }

function buildSeries(byDay: AdminRevenueByDay[], days: number) {
  const lookup = new Map(byDay.map((row) => [row.day, row]))
  const today = new Date()
  const toPoint = (offset: number): DayPoint => {
    const key = dayKey(new Date(today.getTime() - offset * DAY_MS))
    const row = lookup.get(key)
    return { key, label: formatDay(key), revenue: row ? Number(row.totalAmount) : 0, payments: row?.paymentCount ?? 0 }
  }
  const current: DayPoint[] = []
  const previous: DayPoint[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) current.push(toPoint(offset))
  for (let offset = days * 2 - 1; offset >= days; offset -= 1) previous.push(toPoint(offset))
  return { current, previous }
}

function RevenueTooltip({ active, payload }: { active?: boolean; payload?: { payload: DayPoint }[] }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-xl bg-popover/90 px-3 py-2 text-[13px] shadow-lg ring-1 ring-border/60 backdrop-blur-xl">
      <p className="text-muted-foreground">{formatDay(point.key, { weekday: "short", day: "numeric", month: "short" })}</p>
      <p className="font-semibold tabular-nums">{formatKes(point.revenue)}</p>
      <p className="text-muted-foreground">{point.payments} payment{point.payments === 1 ? "" : "s"}</p>
    </div>
  )
}

export function AdminRevenueDashboard({
  byVenue,
  byDay,
  days,
  periods,
}: {
  byVenue: AdminRevenueByVenue[]
  byDay: AdminRevenueByDay[]
  days: number
  periods: number[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const filteredVenues = useAdminSearchFilter(byVenue, (row) => row.locationName)

  const stats = useMemo(() => {
    const { current, previous } = buildSeries(byDay, days)
    const total = current.reduce((sum, point) => sum + point.revenue, 0)
    const payments = current.reduce((sum, point) => sum + point.payments, 0)
    const previousTotal = previous.reduce((sum, point) => sum + point.revenue, 0)
    const best = current.reduce<DayPoint | null>((top, point) => (point.revenue > (top?.revenue ?? 0) ? point : top), null)
    const change = previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null
    const activeDays = current.filter((point) => point.payments > 0).reverse()
    return { current, total, payments, previousTotal, best, change, activeDays }
  }, [byDay, days])

  const venueTotal = filteredVenues.reduce((sum, row) => sum + Number(row.totalAmount), 0)
  const sortedVenues = [...filteredVenues].sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount))
  const average = stats.payments > 0 ? stats.total / stats.payments : 0

  const comparison =
    stats.change === null
      ? `Last ${days} days`
      : `${stats.change >= 0 ? "Up" : "Down"} ${Math.abs(stats.change)}% on the previous ${days} days (${formatKes(stats.previousTotal)})`

  return (
    <div className={`space-y-8 transition-opacity ${isPending ? "opacity-60" : ""}`}>
      <LargeTitle
        title={formatKes(stats.total)}
        subtitle={comparison}
        accessory={
          <SegmentedControl<string>
            label="Time period"
            value={String(days)}
            onChange={(value) => startTransition(() => router.push(`/admin/revenue?days=${value}`, { scroll: false }))}
            options={periods.map((period) => ({ value: String(period), label: `${period} days` }))}
          />
        }
      />

      {/* Fixed height: an aspect-ratio chart here made the page scrollbar toggle in a loop (flicker). */}
      <section className="rounded-2xl bg-card px-2 pt-4 pb-2 ring-1 ring-border/60">
        {stats.total === 0 ? (
          <div className="grid h-[240px] place-items-center text-[15px] text-muted-foreground">No paid revenue in this period.</div>
        ) : (
          <ChartContainer config={revenueChartConfig} className="aspect-auto h-[240px] w-full">
            <BarChart data={stats.current} margin={{ left: 0, right: 8, top: 4, bottom: 0 }} barCategoryGap={days > 30 ? 1 : "20%"}>
              <CartesianGrid vertical={false} className="stroke-border/50" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(value: number) => formatCompact(value)} />
              <ChartTooltip cursor={{ className: "fill-muted/60" }} content={<RevenueTooltip />} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ChartContainer>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <GroupedSection header="Summary">
            <ValueRow label="Payments" value={stats.payments.toLocaleString(NUMBER_LOCALE)} />
            <ValueRow label="Average payment" value={stats.payments > 0 ? formatKes(average) : "—"} />
            <ValueRow
              label="Best day"
              value={stats.best ? `${formatKes(stats.best.revenue)} · ${stats.best.label}` : "—"}
            />
          </GroupedSection>

          <GroupedSection header="By venue">
            {sortedVenues.length === 0 ? (
              <li className="px-4 py-3 text-[15px] text-muted-foreground">No venue revenue in this period.</li>
            ) : (
              sortedVenues.map((row) => {
                const amount = Number(row.totalAmount)
                const share = venueTotal > 0 ? Math.round((amount / venueTotal) * 100) : 0
                return (
                  <li key={row.locationId} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3 text-[15px]">
                      <span className="truncate">{row.locationName}</span>
                      <span className="shrink-0 tabular-nums">{formatKes(amount)}</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-foreground/70" style={{ width: `${share}%` }} />
                    </div>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {share}% · {row.paymentCount} payment{row.paymentCount === 1 ? "" : "s"}
                    </p>
                  </li>
                )
              })
            )}
          </GroupedSection>
        </div>

        <section>
          <div className="px-4 pb-1.5 text-[13px] tracking-[0.01em] text-muted-foreground uppercase">Days with payments</div>
          <GroupedList>
            {stats.activeDays.length === 0 ? (
              <li className="px-4 py-3 text-[15px] text-muted-foreground">No payments in this period.</li>
            ) : (
              stats.activeDays.map((point) => (
                <ValueRow
                  key={point.key}
                  label={formatDay(point.key, { weekday: "long", day: "numeric", month: "long" })}
                  value={formatKes(point.revenue)}
                  detail={`${point.payments} payment${point.payments === 1 ? "" : "s"}`}
                />
              ))
            )}
          </GroupedList>
        </section>
      </div>
    </div>
  )
}
