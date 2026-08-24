import { AlertAcknowledgeButton } from "@/components/admin/admin-alert-acknowledge-button"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AlertDispatchStatus } from "@/server/operations/alert-dispatch-types"
import type {
  AlertSeverity,
  OperationalAlert,
  TenantOperationalAlerts,
} from "@/server/operations/alert-types"

function severityLabel(severity: AlertSeverity) {
  switch (severity) {
    case "critical":
      return "Critical"
    case "warning":
      return "Warning"
    case "info":
      return "Info"
  }
}

function severityVariant(severity: AlertSeverity) {
  switch (severity) {
    case "critical":
      return "destructive" as const
    case "warning":
      return "outline" as const
    case "info":
      return "secondary" as const
  }
}

function AlertCard({
  alert,
  acknowledged,
}: {
  alert: OperationalAlert
  acknowledged: boolean
}) {
  return (
    <article className="rounded-xl border border-border/70 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{alert.title}</h3>
            <Badge variant={severityVariant(alert.severity)}>
              {severityLabel(alert.severity)}
            </Badge>
            <Badge variant="outline">{alert.code}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{alert.summary}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Owner: {alert.owner}</span>
            <span>Escalation: {alert.escalation}</span>
            <span>Fired: {new Date(alert.firedAt).toLocaleString()}</span>
          </div>
          <code className="block rounded bg-muted px-2 py-1 text-xs">
            {alert.runbookPath}
          </code>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <AlertAcknowledgeButton
            alertId={alert.id}
            acknowledged={acknowledged}
          />
          {alert.href ? (
            <Button asChild size="sm">
              <Link href={alert.href}>Open</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function AdminAlertsPanel({
  alertsOverview,
  dispatchStatus,
  acknowledgedAlertIds,
}: {
  alertsOverview: TenantOperationalAlerts
  dispatchStatus: AlertDispatchStatus
  acknowledgedAlertIds: string[]
}) {
  const { alerts, counts, generatedAt } = alertsOverview
  const acknowledged = new Set(acknowledgedAlertIds)
  const grouped = {
    critical: alerts.filter((alert) => alert.severity === "critical"),
    warning: alerts.filter((alert) => alert.severity === "warning"),
    info: alerts.filter((alert) => alert.severity === "info"),
  }

  return (
    <div className="space-y-6">
      <section className="admin-dashboard-card flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Active alerts</p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">
              {counts.total === 0 ? "All clear" : `${counts.total} active`}
            </h2>
            {counts.critical > 0 ? (
              <Badge variant="destructive">{counts.critical} critical</Badge>
            ) : null}
            {counts.warning > 0 ? (
              <Badge variant="outline">{counts.warning} warning</Badge>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {new Date(generatedAt).toLocaleString()}
        </p>
      </section>

      <section className="admin-dashboard-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">On-call paging</p>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">
                {dispatchStatus.config.enabled ? "Enabled" : "Disabled"}
              </h3>
              <Badge
                variant={
                  dispatchStatus.config.enabled ? "default" : "secondary"
                }
              >
                {dispatchStatus.config.webhookConfigured
                  ? dispatchStatus.config.channel
                  : "webhook not configured"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Dispatches {dispatchStatus.config.minSeverity} alerts and above
              every {dispatchStatus.config.cooldownMinutes} minutes via cron.
            </p>
          </div>
        </div>

        {dispatchStatus.recentDispatches.length > 0 ? (
          <div className="grid gap-2">
            {dispatchStatus.recentDispatches.map((entry) => (
              <div
                key={`${entry.alertId}:${entry.dispatchedAt}`}
                className="rounded-xl border border-border/70 px-3 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{entry.alertId}</span>
                  <Badge variant={entry.success ? "default" : "destructive"}>
                    {entry.success ? "dispatched" : "failed"}
                  </Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {new Date(entry.dispatchedAt).toLocaleString()}
                  {entry.channel ? ` · ${entry.channel}` : ""}
                  {entry.error ? ` · ${entry.error}` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No audited dispatch events yet. Set `OPS_ALERT_DISPATCH_ENABLED=true`
            and `OPS_ALERT_WEBHOOK_URL` to enable external paging.
          </p>
        )}
      </section>

      {counts.total === 0 ? (
        <section className="admin-dashboard-card">
          <p className="text-sm text-muted-foreground">
            No degraded or down health signals are active. Alerts are derived from
            the tenant health overview.
          </p>
        </section>
      ) : (
        <>
          {grouped.critical.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-base font-semibold">Critical</h3>
              <div className="grid gap-3">
                {grouped.critical.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    acknowledged={acknowledged.has(alert.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {grouped.warning.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-base font-semibold">Warning</h3>
              <div className="grid gap-3">
                {grouped.warning.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    acknowledged={acknowledged.has(alert.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

    </div>
  )
}

export function AdminActiveAlertsStrip({
  alertsOverview,
}: {
  alertsOverview: TenantOperationalAlerts
}) {
  if (alertsOverview.counts.total === 0) {
    return null
  }

  return (
    <section className="admin-dashboard-card flex flex-wrap items-center justify-between gap-3 border-destructive/30 bg-destructive/5">
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {alertsOverview.counts.total} active alert
          {alertsOverview.counts.total === 1 ? "" : "s"}
        </p>
        <p className="text-sm text-muted-foreground">
          {alertsOverview.counts.critical} critical · {alertsOverview.counts.warning}{" "}
          warning
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href="/admin/alerts">View alerts</Link>
      </Button>
    </section>
  )
}
