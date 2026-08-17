import { createHash } from "node:crypto"

export function hashWebhookPayload(rawBody) {
  return createHash("sha256").update(rawBody, "utf8").digest("hex")
}

export function extractPaystackProviderEventId(event) {
  const eventType =
    typeof event.event === "string" && event.event.length > 0
      ? event.event
      : "unknown"
  const providerId =
    typeof event.data?.id === "number" || typeof event.data?.id === "string"
      ? String(event.data.id)
      : null

  return providerId ? `${eventType}:${providerId}` : null
}
