import Link from "next/link"
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr"

import { AlertAcknowledgeButton } from "@/components/admin/admin-alert-acknowledge-button"
import { GroupedList, SectionFooter, SectionHeader } from "@/components/admin/admin-grouped"
import { runbookHref } from "@/components/admin/runbook-href"
import type { AlertDispatchStatus } from "@/server/operations/alert-dispatch-types"
import type {
  AlertSeverity,
  OperationalAlert,
  TenantOperationalAlerts,
} from "@/server/operations/alert-types"

// Severity is carried by words and ordering, not color.
const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
}
const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }

// Fixed locale + zone so server-rendered text matches the browser.
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Nairobi",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Nairobi",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})

/** Relative to when the report was generated, so it is deterministic. */
function ago(iso: string, referenceIso: string) {
  const seconds = Math.max(0, Math.round((new Date(referenceIso).getTime() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return "Just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}

/** Titles arrive as "Replay failure · PlayTT Hurlingham"; the venue is shown separately. */
function cleanTitle(alert: OperationalAlert) {
  if (alert.venueName && alert.title.endsWith(` · ${alert.venueName}`)) {
    return alert.title.slice(0, -` · ${alert.venueName}`.length)
  }
  return alert.title
}

function AlertRow({
  alert,
  acknowledged,
  generatedAt,
}: {
  alert: OperationalAlert
  acknowledged: boolean
  generatedAt: string
}) {
  const meta = [
    SEVERITY_LABEL[alert.severity],
    alert.venueName,
    ago(alert.firedAt, generatedAt),
  ].filter(Boolean)

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted-foreground">
          <span className={alert.severity === "critical" && !acknowledged ? "font-semibold text-foreground" : ""}>
            {meta[0]}
          </span>
          {meta.slice(1).map((part) => ` · ${part}`)}
        </p>
        <p className={`mt-0.5 text-[15px] font-semibold tracking-[-0.01em] ${acknowledged ? "text-muted-foreground" : ""}`}>
          {cleanTitle(alert)}
        </p>
        <p className="mt-0.5 text-[15px] text-muted-foreground">{alert.summary}</p>
      </div>
      {alert.href ? <CaretRightIcon size={16} className="mt-6 shrink-0 text-muted-foreground/50" aria-hidden /> : null}
    </>
  )

  return (
    <li>
      {alert.href ? (
        <Link
          href={alert.href}
          className="flex items-start gap-3 px-4 pt-3.5 pb-1 transition-colors duration-100 active:bg-muted/60"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-3 px-4 pt-3.5 pb-1">{body}</div>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 pt-1 pb-3 text-[13px]">
        <AlertAcknowledgeButton alertId={alert.id} acknowledged={acknowledged} />
        <Link
          href={runbookHref(alert.runbookPath)}
          target="_blank"
          rel="noreferrer"
          className="text-primary transition-opacity active:opacity-50"
        >
          Runbook
        </Link>
        <span className="ml-auto text-muted-foreground">
          {alert.owner} · then {alert.escalation}
        </span>
      </div>
    </li>
  )
}

function PagingSection({ dispatchStatus }: { dispatchStatus: AlertDispatchStatus }) {
  const { config, recentDispatches } = dispatchStatus
  const live = config.enabled && config.webhookConfigured
  const channel = config.channel === "slack_webhook" ? "Slack" : "Webhook"

  const rows: { label: string; value: string }[] = [
    { label: "On-call paging", value: live ? "On" : config.enabled ? "No webhook" : "Off" },
    ...(live
      ? [
          { label: "Sends to", value: channel },
          { label: "Minimum severity", value: SEVERITY_LABEL[config.minSeverity] },
          { label: "Repeat at most every", value: `${config.cooldownMinutes} min` },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader>Paging</SectionHeader>
        <GroupedList>
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 px-4 py-3 text-[15px]">
              <span>{row.label}</span>
              <span className="text-muted-foreground">{row.value}</span>
            </li>
          ))}
        </GroupedList>
        <SectionFooter>
          {live ? (
            "Alerts at or above the minimum severity are sent automatically."
          ) : (
            <>
              Nobody is notified when something breaks. To turn this on, set{" "}
              <code className="font-mono text-[12px]">OPS_ALERT_DISPATCH_ENABLED</code> and{" "}
              <code className="font-mono text-[12px]">OPS_ALERT_WEBHOOK_URL</code> in the deployment.
            </>
          )}
        </SectionFooter>
      </section>

      {recentDispatches.length > 0 ? (
        <section>
          <SectionHeader>Recent pages</SectionHeader>
          <GroupedList>
            {recentDispatches.slice(0, 6).map((entry) => (
              <li key={`${entry.alertId}:${entry.dispatchedAt}`} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-[15px]">
                  <span className="truncate">{entry.alertId}</span>
                  <span className="shrink-0 text-muted-foreground">{entry.success ? "Sent" : "Failed"}</span>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {dateTimeFormat.format(new Date(entry.dispatchedAt))}
                  {entry.error ? ` · ${entry.error}` : ""}
                </p>
              </li>
            ))}
          </GroupedList>
        </section>
      ) : null}
    </div>
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
  const order = (a: OperationalAlert, b: OperationalAlert) =>
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.firedAt.localeCompare(a.firedAt)
  const open = alerts.filter((alert) => !acknowledged.has(alert.id)).sort(order)
  const parked = alerts.filter((alert) => acknowledged.has(alert.id)).sort(order)

  const breakdown = (["critical", "warning", "info"] as const)
    .filter((severity) => counts[severity] > 0)
    .map((severity) => `${counts[severity]} ${SEVERITY_LABEL[severity].toLowerCase()}`)
    .join(", ")

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-8">
        <header className="px-4">
          <h2 className="font-heading text-[34px] leading-[1.1] font-bold tracking-[-0.022em]">
            {counts.total === 0 ? "All clear" : `${counts.total} ${counts.total === 1 ? "alert" : "alerts"}`}
          </h2>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {counts.total === 0 ? "Everything is reporting healthy." : breakdown}
            {" · "}checked {timeFormat.format(new Date(generatedAt))}
          </p>
        </header>

        {open.length > 0 ? (
          <section>
            <SectionHeader>Needs attention</SectionHeader>
            <GroupedList>
              {open.map((alert) => (
                <AlertRow key={alert.id} alert={alert} acknowledged={false} generatedAt={generatedAt} />
              ))}
            </GroupedList>
            <SectionFooter>Tap an alert to go to the page where it can be fixed. Alerts clear by themselves once the cause is resolved.</SectionFooter>
          </section>
        ) : null}

        {parked.length > 0 ? (
          <section>
            <SectionHeader>Acknowledged</SectionHeader>
            <GroupedList>
              {parked.map((alert) => (
                <AlertRow key={alert.id} alert={alert} acknowledged generatedAt={generatedAt} />
              ))}
            </GroupedList>
            <SectionFooter>Still active, but someone is on it.</SectionFooter>
          </section>
        ) : null}

        {counts.total === 0 ? (
          <p className="px-4 text-[15px] text-muted-foreground">
            Alerts appear here when a signal on the{" "}
            <Link href="/admin/health" className="text-primary">
              health overview
            </Link>{" "}
            becomes degraded or down.
          </p>
        ) : null}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <PagingSection dispatchStatus={dispatchStatus} />
      </aside>
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

  const { counts } = alertsOverview
  const breakdown = (["critical", "warning", "info"] as const)
    .filter((severity) => counts[severity] > 0)
    .map((severity) => `${counts[severity]} ${SEVERITY_LABEL[severity].toLowerCase()}`)
    .join(", ")

  return (
    <GroupedList>
      <li>
        <Link
          href="/admin/alerts"
          className="flex items-center gap-3 px-4 py-3 transition-colors duration-100 hover:bg-muted/30 active:bg-muted/60"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">
              {counts.total} active alert{counts.total === 1 ? "" : "s"}
            </p>
            <p className="text-[13px] text-muted-foreground">{breakdown}</p>
          </div>
          <span className="shrink-0 text-[15px] text-primary">View</span>
          <CaretRightIcon size={14} className="shrink-0 text-muted-foreground/50" aria-hidden />
        </Link>
      </li>
    </GroupedList>
  )
}
