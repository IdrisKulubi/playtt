"use client"

import Link from "next/link"
import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import { useAdminSearchFilter } from "@/components/admin/admin-context"
import { AdminDashboardCard } from "@/components/admin/admin-dashboard"
import { Badge } from "@/components/ui/badge"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  AdminBookingRow,
  AdminOverviewMetrics,
  AdminRevenueByDay,
} from "@/server/admin/analytics-service"

const revenueChartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

const occupancyChartConfig = {
  active: { label: "Active sessions", color: "var(--chart-1)" },
  idle: { label: "Idle tables", color: "var(--chart-4)" },
} satisfies ChartConfig

export function AdminOverviewCharts({
  metrics,
  revenueByDay,
}: {
  metrics: AdminOverviewMetrics
  revenueByDay: AdminRevenueByDay[]
}) {
  const chartData = revenueByDay.map((row) => ({
    day: row.day.slice(5),
    revenue: Number(row.totalAmount),
  }))

  const idleTables = Math.max(
    metrics.totalActiveResources - metrics.activeSessions,
    0,
  )
  const occupancyData = [
    { name: "active", value: metrics.activeSessions, fill: "var(--color-active)" },
    { name: "idle", value: idleTables, fill: "var(--color-idle)" },
  ]

  return (
    <div className="admin-chart-grid">
      <AdminDashboardCard title="Revenue by day" className="admin-dashboard-card">
        <ChartContainer config={revenueChartConfig} className="min-h-[280px] w-full">
          <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
            <XAxis dataKey="day" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={48} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </AdminDashboardCard>

      <AdminDashboardCard title="Table occupancy" className="admin-dashboard-card">
        <ChartContainer config={occupancyChartConfig} className="mx-auto min-h-[280px] max-w-[280px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={occupancyData}
              dataKey="value"
              nameKey="name"
              innerRadius={70}
              outerRadius={100}
              strokeWidth={4}
            >
              {occupancyData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
          </PieChart>
        </ChartContainer>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {metrics.totalActiveResources} active tables across all venues
        </p>
      </AdminDashboardCard>
    </div>
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
    [
      booking.userName,
      booking.userEmail,
      booking.locationName,
      booking.resourceName,
      booking.status,
      booking.paymentStatus,
    ].join(" "),
  )

  return (
    <AdminDashboardCard
      title={title}
      action={
        showViewAll ? (
          <Link href="/admin/bookings" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        ) : null
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>Venue</TableHead>
            <TableHead>Table</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No bookings match your search.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell>
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="block rounded-md transition hover:bg-muted/40"
                  >
                    <div>
                      <p className="font-medium">{booking.userName}</p>
                      <p className="text-xs text-muted-foreground">{booking.userEmail}</p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="block rounded-md transition hover:bg-muted/40"
                  >
                    {booking.locationName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="block rounded-md transition hover:bg-muted/40"
                  >
                    {booking.resourceName}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="block rounded-md transition hover:bg-muted/40"
                  >
                    {new Date(booking.startTime).toLocaleString()}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="block rounded-md transition hover:bg-muted/40"
                  >
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{booking.status}</Badge>
                      <Badge variant="secondary">{booking.paymentStatus}</Badge>
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="block rounded-md transition hover:bg-muted/40"
                  >
                    {booking.currency} {booking.totalAmount}
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </AdminDashboardCard>
  )
}
