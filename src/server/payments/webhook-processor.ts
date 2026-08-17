export type PaystackWebhookProcessingResult = {
  body: "Invalid payload" | "Invalid signature" | "OK" | "Webhook processing failed"
  failureKind?: "configuration-error" | "inbox-error"
  status: 200 | 400 | 401 | 500
}

export {
  processPaystackWebhook,
  verifyPaystackWebhookSignature,
} from "./webhook-processor.mjs"
