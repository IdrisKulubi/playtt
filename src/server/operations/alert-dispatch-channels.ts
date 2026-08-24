import type { AlertDispatchChannel, AlertDispatchPayload } from "./alert-dispatch-types.ts"

function severityEmoji(severity: AlertDispatchPayload["severity"]) {
  switch (severity) {
    case "critical":
      return ":rotating_light:"
    case "warning":
      return ":warning:"
    case "info":
      return ":information_source:"
  }
}

export function buildAlertDispatchPayload(input: {
  alert: AlertDispatchPayload["alert"]
  environment?: string | null
  appBaseUrl?: string | null
}): AlertDispatchPayload {
  return {
    source: "playtt",
    event: "operational_alert",
    severity: input.alert.severity,
    environment: input.environment ?? null,
    alert: input.alert,
    adminUrl: input.appBaseUrl ? `${input.appBaseUrl}/admin/alerts` : null,
  }
}

export function buildSlackWebhookBody(payload: AlertDispatchPayload) {
  const lines = [
    `${severityEmoji(payload.severity)} *${payload.alert.title}*`,
    `Severity: ${payload.severity}`,
    `Summary: ${payload.alert.summary}`,
    `Owner: ${payload.alert.owner}`,
    `Runbook: ${payload.alert.runbookPath}`,
  ]

  if (payload.alert.venueName) {
    lines.push(`Venue: ${payload.alert.venueName}`)
  }

  if (payload.adminUrl) {
    lines.push(`Alerts: ${payload.adminUrl}`)
  }

  return {
    text: `PlayTT ${payload.severity} alert: ${payload.alert.title}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: lines.join("\n"),
        },
      },
    ],
  }
}

export function buildWebhookBody(
  channel: AlertDispatchChannel,
  payload: AlertDispatchPayload,
) {
  if (channel === "slack_webhook") {
    return buildSlackWebhookBody(payload)
  }

  return payload
}

export async function postAlertDispatchWebhook(input: {
  webhookUrl: string
  channel: AlertDispatchChannel
  payload: AlertDispatchPayload
}) {
  const body = buildWebhookBody(input.channel, input.payload)
  const response = await fetch(input.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}`)
  }
}
