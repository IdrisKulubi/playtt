import { buildTenantOperationalAlertsFromOverview } from "@/server/operations/alerts-service"
import { postAlertDispatchWebhook } from "@/server/operations/alert-dispatch-channels.ts"
import {
  resolveAlertDispatchConfig,
  shouldDispatchAlert,
} from "@/server/operations/alert-dispatch-policy.ts"
import { listRecentAlertActionAudit } from "@/server/operations/alert-actions-repository.ts"
import {
  listRecentlyDispatchedAlertIds,
} from "@/server/operations/alert-dispatch-repository.ts"
import type {
  AlertDispatchAttempt,
  AlertDispatchReport,
  AlertDispatchStatus,
} from "@/server/operations/alert-dispatch-types.ts"
import {
  OPERATIONAL_ALERT_DISPATCH_ACTION,
  OPERATIONAL_ALERT_DISPATCH_FAILED_ACTION,
} from "@/server/operations/alert-dispatch-types.ts"
import { getTenantHealthOverview } from "@/server/operations/health-service"
import { resolveDeploymentEnvironment } from "@/server/operations/environment-profile.ts"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import type { TenantContext } from "@/server/tenancy/types"

function buildDispatchReport(
  config: AlertDispatchReport["config"],
  attempts: AlertDispatchAttempt[],
): AlertDispatchReport {
  return {
    generatedAt: new Date().toISOString(),
    config,
    attempts,
    sentCount: attempts.filter((attempt) => attempt.status === "sent").length,
    skippedCount: attempts.filter((attempt) => attempt.status === "skipped")
      .length,
    failedCount: attempts.filter((attempt) => attempt.status === "failed")
      .length,
  }
}

export async function dispatchOperationalAlerts(
  context: TenantContext,
): Promise<AlertDispatchReport> {
  const config = resolveAlertDispatchConfig()
  const attempts: AlertDispatchAttempt[] = []

  if (!config.enabled || !config.webhookUrl) {
    return buildDispatchReport(config, attempts)
  }

  const overview = await getTenantHealthOverview(context)
  const alertsOverview = buildTenantOperationalAlertsFromOverview(overview)
  const cooldownSince = new Date(
    Date.now() - config.cooldownMinutes * 60 * 1000,
  )
  const recentlyDispatched = await listRecentlyDispatchedAlertIds(
    context.tenantId,
    cooldownSince,
  )
  const environment = resolveDeploymentEnvironment()

  for (const alert of alertsOverview.alerts) {
    if (!shouldDispatchAlert(alert.severity, config)) {
      attempts.push({
        alertId: alert.id,
        alertCode: alert.code,
        severity: alert.severity,
        status: "skipped",
        reason: "below_min_severity",
      })
      continue
    }

    if (recentlyDispatched.has(alert.id)) {
      attempts.push({
        alertId: alert.id,
        alertCode: alert.code,
        severity: alert.severity,
        status: "skipped",
        reason: "cooldown",
      })
      continue
    }

    try {
      await postAlertDispatchWebhook({
        webhookUrl: config.webhookUrl,
        channel: config.channel,
        payload: {
          source: "playtt",
          event: "operational_alert",
          severity: alert.severity,
          environment,
          alert,
          adminUrl: config.appBaseUrl
            ? `${config.appBaseUrl}/admin/alerts`
            : null,
        },
      })

      await writeAuditLog(context, {
        action: OPERATIONAL_ALERT_DISPATCH_ACTION,
        targetType: "operational_alert",
        targetId: alert.id,
        metadata: {
          channel: config.channel,
          severity: alert.severity,
          code: alert.code,
          summary: alert.summary,
          venueId: alert.venueId,
        },
      })

      attempts.push({
        alertId: alert.id,
        alertCode: alert.code,
        severity: alert.severity,
        status: "sent",
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "dispatch_failed"

      await writeAuditLog(context, {
        action: OPERATIONAL_ALERT_DISPATCH_FAILED_ACTION,
        targetType: "operational_alert",
        targetId: alert.id,
        metadata: {
          channel: config.channel,
          severity: alert.severity,
          code: alert.code,
          error: message,
        },
      })

      attempts.push({
        alertId: alert.id,
        alertCode: alert.code,
        severity: alert.severity,
        status: "failed",
        reason: message,
      })
    }
  }

  return buildDispatchReport(config, attempts)
}

export async function getAlertDispatchStatus(
  context: TenantContext,
): Promise<AlertDispatchStatus> {
  authorize(context, "venue.read")

  const config = resolveAlertDispatchConfig()
  const recentDispatches = await listRecentAlertActionAudit(context.tenantId)

  return {
    config,
    recentDispatches,
  }
}
