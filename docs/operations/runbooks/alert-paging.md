# Operational alert paging

Use when active health alerts must notify on-call operators outside the admin console.

## Configure

Set these environment variables in the hosted deployment:

- `OPS_ALERT_DISPATCH_ENABLED=true`
- `OPS_ALERT_WEBHOOK_URL` — Slack incoming webhook or generic JSON endpoint
- `OPS_ALERT_MIN_SEVERITY=critical` — optional; `warning` pages degraded alerts too
- `OPS_ALERT_COOLDOWN_MINUTES=30` — suppress duplicate pages for the same alert id
- `OPS_ALERT_DISPATCH_CHANNEL=slack_webhook` — or `generic_webhook`

Cron route: `/api/cron/operational-alerts` (every 5 minutes via `vercel.json`).

Manual dispatch: `pnpm ops:dispatch-alerts`

## Check

1. Open **Admin → Alerts** and confirm active alerts exist.
2. Verify the **On-call paging** panel shows `Enabled`.
3. Review recent audited dispatch events on the same page.

## Diagnose

- Dispatch disabled because `OPS_ALERT_WEBHOOK_URL` is missing.
- Webhook returns non-2xx (check `operational_alert.dispatch_failed` audit rows).
- Alert skipped due to cooldown or below minimum severity.

## Recover

1. Fix the webhook URL or channel permissions.
2. Run `pnpm ops:dispatch-alerts` against staging with a test webhook.
3. Confirm `operational_alert.dispatched` rows appear in `audit_logs`.

## Verify

- Critical alerts reach the on-call channel within one cron interval.
- Repeated cron runs do not spam the same alert during cooldown.
- Every dispatch attempt is recorded in `audit_logs`.
