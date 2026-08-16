import { handlePaystackWebhookEvent } from "@/server/payments/service"
import type { PaystackWebhookEvent } from "@/server/payments/types"
import { processPaystackWebhook } from "@/server/payments/webhook-processor"

export const runtime = "nodejs"

export async function POST(req: Request) {
  let rawBody: string

  try {
    rawBody = await req.text()
  } catch {
    console.error("[PAYSTACK WEBHOOK] Could not read request body.")
    return new Response("Webhook processing failed", { status: 500 })
  }

  const signature = req.headers.get("x-paystack-signature")
  const result = await processPaystackWebhook<PaystackWebhookEvent>({
    handleEvent: handlePaystackWebhookEvent,
    rawBody,
    secret: process.env.PAYSTACK_SECRET_KEY,
    signature,
  })

  if (result.failureKind === "configuration-error") {
    console.error("[PAYSTACK WEBHOOK] PAYSTACK_SECRET_KEY is not configured.")
  } else if (result.failureKind === "handler-error") {
    console.error("[PAYSTACK WEBHOOK] Handler failed.")
  }

  return new Response(result.body, { status: result.status })
}
