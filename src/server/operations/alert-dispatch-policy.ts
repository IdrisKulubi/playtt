import type { AlertSeverity } from "./alert-types.ts"
import { severityRank } from "./alert-types.ts"
import type { AlertDispatchConfig } from "./alert-dispatch-types.ts"

const DEFAULT_COOLDOWN_MINUTES = 30

function parseMinSeverity(value: string | undefined): AlertSeverity {
  const normalized = value?.trim().toLowerCase()

  if (normalized === "warning" || normalized === "info") {
    return normalized
  }

  return "critical"
}

function parseChannel(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()

  if (normalized === "generic_webhook") {
    return "generic_webhook" as const
  }

  return "slack_webhook" as const
}

export function resolveAlertDispatchConfig(
  env: NodeJS.ProcessEnv = process.env,
): AlertDispatchConfig {
  const webhookUrl = env.OPS_ALERT_WEBHOOK_URL?.trim() ?? null
  const enabled =
    env.OPS_ALERT_DISPATCH_ENABLED === "true" && Boolean(webhookUrl)

  return {
    enabled,
    webhookConfigured: Boolean(webhookUrl),
    webhookUrl,
    channel: parseChannel(env.OPS_ALERT_DISPATCH_CHANNEL),
    minSeverity: parseMinSeverity(env.OPS_ALERT_MIN_SEVERITY),
    cooldownMinutes: Number.parseInt(
      env.OPS_ALERT_COOLDOWN_MINUTES ?? "",
      10,
    ) || DEFAULT_COOLDOWN_MINUTES,
    appBaseUrl: env.NEXT_PUBLIC_APP_URL?.trim() ?? null,
  }
}

export function shouldDispatchAlert(
  alertSeverity: AlertSeverity,
  config: AlertDispatchConfig,
) {
  if (!config.enabled) {
    return false
  }

  return severityRank(alertSeverity) >= severityRank(config.minSeverity)
}
