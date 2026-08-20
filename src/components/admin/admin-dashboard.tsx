import type { ReactNode } from "react"

import type { AdminOverviewMetrics } from "@/server/admin/analytics-service"

export function AdminKpiGrid({
  metrics,
}: {
  metrics: AdminOverviewMetrics
}) {
  const revenueDelta =
    metrics.revenueLast7Days > 0 && metrics.revenueLast30Days > 0
      ? Math.round(
          ((metrics.revenueLast7Days * 4.3 - metrics.revenueLast30Days) /
            metrics.revenueLast30Days) *
            100,
        )
      : null

  return (
    <div className="admin-kpi-grid">
      <AdminKpiCard
        label="Revenue (30 days)"
        value={`KES ${metrics.revenueLast30Days.toLocaleString()}`}
        delta={
          revenueDelta !== null
            ? `${revenueDelta >= 0 ? "+" : ""}${revenueDelta}% vs monthly pace`
            : undefined
        }
      />
      <AdminKpiCard
        label="Venues"
        value={String(metrics.venueCount)}
        delta={`${metrics.activeDevices} active devices`}
      />
      <AdminKpiCard
        label="Members"
        value={String(metrics.memberCount)}
        delta={`${metrics.todayBookings} bookings today`}
      />
      <AdminKpiCard
        label="Active sessions"
        value={String(metrics.activeSessions)}
        delta={`${metrics.totalActiveResources} tables available`}
      />
    </div>
  )
}

export function AdminKpiCard({
  label,
  value,
  delta,
}: {
  label: string
  value: string
  delta?: string
}) {
  return (
    <div className="admin-kpi-card">
      <p className="admin-kpi-card__label">{label}</p>
      <p className="admin-kpi-card__value">{value}</p>
      {delta ? <p className="admin-kpi-card__delta">{delta}</p> : null}
    </div>
  )
}

export function AdminDashboardCard({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={className ?? "admin-table-card"}>
      <div className="admin-table-card__header">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      <div className="admin-table-card__body">{children}</div>
    </section>
  )
}
