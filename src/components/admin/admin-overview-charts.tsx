"use client"

import Link from "next/link"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { CaretRightIcon } from "@phosphor-icons/react"

import { useAdminSearchFilter } from "@/components/admin/admin-context"
import {
  GroupedList,
  GroupedSection,
  LargeTitle,
  SectionHeader,
  ValueRow,
} from "@/components/admin/admin-grouped"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import type {
  AdminBookingRow,
  AdminOverviewMetrics,
  AdminRevenueByDay,
} from "@/server/admin/analytics-service"

const revenueChartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig

const DAY_MS = 86_400_000
const DELETED_EMAIL_SUFFIX = "@deleted.theplaytt.com"
// Fixed locales/zone so server and browser render identical text.
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Nairobi",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})

function kes(value: number) {
  return `KES ${Math.round(value).toLocaleString("en-KE")}`
}

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`
  return String(value)
}

type DayPoint = { key: string; label: string; revenue: number }

function last30Days(revenueByDay: AdminRevenueByDay[]): DayPoint[] {
  const lookup = new Map(revenueByDay.map((row) => [row.day, Number(row.totalAmount)]))
  const today = Date.now()
  const points: DayPoint[] = []
  for (let offset = 29; offset >= 0; offset -= 1) {
    const key = new Date(today - offset * DAY_MS).toISOString().slice(0, 10)
    points.push({
      key,
      label: new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
      revenue: lookup.get(key) ?? 0,
    })
  }
  return points
}

function RevenueTooltip({ active, payload }: { active?: boolean; payload?: { payload: DayPoint }[] }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-xl bg-popover/90 px-3 py-2 text-[13px] shadow-lg ring-1 ring-border/60 backdrop-blur-xl">
      <p className="text-muted-foreground">{point.label}</p>
      <p className="font-semibold tabular-nums">{kes(point.revenue)}</p>
    </div>
  )
}

/** Overview: one headline number, today's status, the 30-day trend and platform counts. */
export function AdminOverviewCharts({
  metrics,
  revenueByDay,
}: {
  metrics: AdminOverviewMetrics
  revenueByDay: AdminRevenueByDay[]
}) {
  const data = last30Days(revenueByDay)
  const tables = metrics.totalActiveResources
  const inUse = Math.min(metrics.activeSessions, tables)
  const occupancy = tables > 0 ? Math.round((inUse / tables) * 100) : 0

  return (
    <div className="space-y-8">
      <LargeTitle
        title={kes(metrics.revenueLast30Days)}
        subtitle={`Revenue in the last 30 days · ${kes(metrics.revenueLast7Days)} in the last 7`}
        accessory={
          <Link href="/admin/revenue" className="text-[15px] text-primary">
            Revenue details
          </Link>
        }
      />

      <section className="rounded-2xl bg-card px-2 pt-4 pb-2 ring-1 ring-border/60">
        {metrics.revenueLast30Days === 0 ? (
          <div className="grid h-[200px] place-items-center text-[15px] text-muted-foreground">No paid revenue in the last 30 days.</div>
        ) : (
          // Fixed height: an aspect-ratio chart here can make the page scrollbar toggle in a loop.
          <ChartContainer config={revenueChartConfig} className="aspect-auto h-[200px] w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} className="stroke-border/50" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
              <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(value: number) => compact(value)} />
              <ChartTooltip cursor={{ className: "fill-muted/60" }} content={<RevenueTooltip />} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ChartContainer>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <GroupedSection header="Right now">
          <ValueRow label="Bookings today" value={metrics.todayBookings} />
          <li className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-4 text-[15px]">
              <span>Tables in use</span>
              <span className="text-muted-foreground tabular-nums">
                {inUse} of {tables}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-foreground/70" style={{ width: `${occupancy}%` }} />
            </div>
          </li>
        </GroupedSection>

        <GroupedSection header="Platform">
          <PlatformRow href="/admin/venues" label="Venues" value={metrics.venueCount} />
          <PlatformRow href="/admin/members" label="Members" value={metrics.memberCount} />
          <PlatformRow
            href="/admin/devices"
            label="Devices"
            value={`${metrics.activeDevices} active${metrics.pendingDevices > 0 ? `, ${metrics.pendingDevices} pending` : ""}`}
          />
          <PlatformRow href="/admin/health" label="Health" value="Check status" />
        </GroupedSection>
      </div>
    </div>
  )
}

function PlatformRow({ href, label, value }: { href: string; label: string; value: string | number }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 text-[15px] transition-colors duration-100 hover:bg-muted/30 active:bg-muted/60"
      >
        <span className="flex-1">{label}</span>
        <span className="text-muted-foreground tabular-nums">{value}</span>
        <CaretRightIcon size={14} className="shrink-0 text-muted-foreground/50" aria-hidden />
      </Link>
    </li>
  )
}

export function AdminBookingsTable({
  bookings,
  title = "Recent bookings",
  showViewAll = false,
}: {
  bookings: AdminBookingRow[]
  title?: string
  showViewAll?: boolean
}) {
  const filtered = useAdminSearchFilter(bookings, (booking) =>
    [booking.userName, booking.userEmail, booking.locationName, booking.resourceName, booking.status, booking.paymentStatus].join(" "),
  )

  return (
    <section>
      <SectionHeader
        accessory={
          showViewAll ? (
            <Link href="/admin/bookings" className="text-[13px] text-primary normal-case">
              See all
            </Link>
          ) : undefined
        }
      >
        {title}
      </SectionHeader>
      <GroupedList>
        {filtered.length === 0 ? (
          <li className="px-4 py-3 text-[15px] text-muted-foreground">No bookings yet.</li>
        ) : (
          filtered.map((booking) => {
            const deleted = booking.userEmail.endsWith(DELETED_EMAIL_SUFFIX)
            const unpaid = booking.paymentStatus !== "paid" && booking.status !== "cancelled"
            return (
              <li key={booking.id}>
                <Link
                  href={`/admin/bookings/${booking.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors duration-100 hover:bg-muted/30 active:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[15px] ${deleted ? "text-muted-foreground" : "font-medium"}`}>
                      {deleted ? "Deleted player" : booking.userName}
                    </p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {timeFormat.format(new Date(booking.startTime))} · {booking.resourceName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[15px] tabular-nums">
                      {booking.currency} {Math.round(Number(booking.totalAmount)).toLocaleString("en-KE")}
                    </p>
                    <p className={`text-[13px] ${unpaid ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {booking.status === "cancelled" ? "Cancelled" : booking.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                    </p>
                  </div>
                  <CaretRightIcon size={14} className="shrink-0 text-muted-foreground/50" aria-hidden />
                </Link>
              </li>
            )
          })
        )}
      </GroupedList>
    </section>
  )
}
