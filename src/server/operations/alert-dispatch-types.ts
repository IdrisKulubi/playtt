import type { AlertSeverity, OperationalAlert } from "./alert-types.ts"

export const OPERATIONAL_ALERT_DISPATCH_ACTION = "operational_alert.dispatched"
export const OPERATIONAL_ALERT_DISPATCH_FAILED_ACTION =
  "operational_alert.dispatch_failed"

export type AlertDispatchChannel = "slack_webhook" | "generic_webhook"

export interface AlertDispatchConfig {
  enabled: boolean
  webhookConfigured: boolean
  webhookUrl: string | null
  channel: AlertDispatchChannel
  minSeverity: AlertSeverity
  cooldownMinutes: number
  appBaseUrl: string | null
}

export interface AlertDispatchPayload {
  source: "playtt"
  event: "operational_alert"
  severity: AlertSeverity
  environment: string | null
  alert: OperationalAlert
  adminUrl: string | null
}

export interface AlertDispatchAttempt {
  alertId: string
  alertCode: string
  severity: AlertSeverity
  status: "sent" | "skipped" | "failed"
  reason?: string
}

export interface AlertDispatchReport {
  generatedAt: string
  config: AlertDispatchConfig
  attempts: AlertDispatchAttempt[]
  sentCount: number
  skippedCount: number
  failedCount: number
}

export interface AlertDispatchAuditEntry {
  alertId: string
  action: string
  dispatchedAt: string
  success: boolean
  channel: string | null
  error: string | null
}

export interface AlertDispatchStatus {
  config: AlertDispatchConfig
  recentDispatches: AlertDispatchAuditEntry[]
}
