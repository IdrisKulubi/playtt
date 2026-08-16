import { createHmac, timingSafeEqual } from "node:crypto"

export type PaystackWebhookProcessingResult = {
  body: "Invalid payload" | "Invalid signature" | "OK" | "Webhook processing failed"
  failureKind?: "configuration-error" | "handler-error"
  status: 200 | 400 | 401 | 500
}

export function verifyPaystackWebhookSignature(input: {
  rawBody: string
  secret: string
  signature: string | null
}) {
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

export async function processPaystackWebhook<T>(input: {
  handleEvent: (event: T) => Promise<unknown>
  rawBody: string
  secret: string | undefined
  signature: string | null
}): Promise<PaystackWebhookProcessingResult> {
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

  let event: T

  try {
    event = JSON.parse(input.rawBody) as T
  } catch {
    return { body: "Invalid payload", status: 400 }
  }

  try {
    await input.handleEvent(event)
  } catch {
    return {
      body: "Webhook processing failed",
      failureKind: "handler-error",
      status: 500,
    }
  }

  return { body: "OK", status: 200 }
}
