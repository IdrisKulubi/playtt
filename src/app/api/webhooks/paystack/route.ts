import { verifyPaystackSignature } from "@/server/payments/paystack-client"
import { handlePaystackWebhookEvent } from "@/server/payments/service"
import type { PaystackWebhookEvent } from "@/server/payments/types"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-paystack-signature")

  if (!verifyPaystackSignature(rawBody, signature)) {
    return new Response("Invalid signature", { status: 401 })
  }

  let event: PaystackWebhookEvent

  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent
  } catch {
    return new Response("Invalid payload", { status: 400 })
  }

  try {
    await handlePaystackWebhookEvent(event)
  } catch (error) {
    console.error("[PAYSTACK WEBHOOK] Handler error:", error)
  }

  return new Response("OK", { status: 200 })
}
