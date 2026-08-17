import { createHmac, timingSafeEqual } from "node:crypto"

import { extractPaystackProviderEventId } from "./webhook-inbox-utils.mjs"

let defaultInboxRepository = null

async function getDefaultInboxRepository() {
  if (!defaultInboxRepository) {
    defaultInboxRepository = await import("./webhook-inbox-repository.ts")
  }

  return defaultInboxRepository
}

export function verifyPaystackWebhookSignature(input) {
  const signature = input.signature?.trim()
  if (!signature || !/^[a-fA-F0-9]{128}$/.test(signature)) {
    return false
  }

  const expected = createHmac("sha512", input.secret)
    .update(input.rawBody, "utf8")
    .digest()
  const provided = Buffer.from(signature, "hex")

  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

export async function processPaystackWebhook(input) {
  const secret = input.secret?.trim()

  if (!secret) {
    return {
      body: "Webhook processing failed",
      failureKind: "configuration-error",
      status: 500,
    }
  }

  if (
    !verifyPaystackWebhookSignature({
      rawBody: input.rawBody,
      secret,
      signature: input.signature,
    })
  ) {
    return { body: "Invalid signature", status: 401 }
  }

  let parsedEvent

  try {
    parsedEvent = JSON.parse(input.rawBody)
  } catch {
    return { body: "Invalid payload", status: 400 }
  }

  const persistWebhook =
    input.persistWebhook ??
    (await getDefaultInboxRepository()).persistPaystackWebhook

  const eventType =
    typeof parsedEvent.event === "string" && parsedEvent.event.length > 0
      ? parsedEvent.event
      : "unknown"

  try {
    await persistWebhook({
      rawBody: input.rawBody,
      signature: input.signature?.trim() ?? "",
      eventType,
      providerEventId: extractPaystackProviderEventId(parsedEvent),
    })
  } catch {
    return {
      body: "Webhook processing failed",
      failureKind: "inbox-error",
      status: 500,
    }
  }

  return { body: "OK", status: 200 }
}
