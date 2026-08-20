"use client"

import { Bar, BarChart, XAxis, YAxis } from "recharts"

import { useAdminSearchFilter } from "@/components/admin/admin-context"
import { AdminDashboardCard } from "@/components/admin/admin-dashboard"
import {
  ChartContainer,
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
import type { AdminRevenueByDay, AdminRevenueByVenue } from "@/server/admin/analytics-service"

const revenueChartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig

export function AdminRevenueDashboard({
  byVenue,
  byDay,
}: {
  byVenue: AdminRevenueByVenue[]
  byDay: AdminRevenueByDay[]
}) {
  const filteredVenues = useAdminSearchFilter(byVenue, (row) => row.locationName)
  const chartData = byDay.map((row) => ({
    day: row.day.slice(5),
    revenue: Number(row.totalAmount),
  }))

  return (
    <div className="space-y-6">
      <AdminDashboardCard title="Revenue trend (30 days)" className="admin-dashboard-card">
        <ChartContainer config={revenueChartConfig} className="min-h-[280px] w-full">
          <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
            <XAxis dataKey="day" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={48} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </AdminDashboardCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminDashboardCard title="Revenue by venue">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVenues.map((row) => (
                <TableRow key={row.locationId}>
                  <TableCell>{row.locationName}</TableCell>
                  <TableCell>{row.paymentCount}</TableCell>
                  <TableCell>KES {Number(row.totalAmount).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminDashboardCard>

        <AdminDashboardCard title="Revenue by day">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byDay.map((row) => (
                <TableRow key={row.day}>
                  <TableCell>{row.day}</TableCell>
                  <TableCell>{row.paymentCount}</TableCell>
                  <TableCell>KES {Number(row.totalAmount).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminDashboardCard>
      </div>
    </div>
  )
}
