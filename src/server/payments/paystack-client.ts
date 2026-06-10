import { createHmac } from "node:crypto"

import { PAYSTACK_API_BASE_URL } from "@/server/payments/constants"
import type {
  PaystackApiResponse,
  PaystackInitializeData,
  PaystackTransactionData,
} from "@/server/payments/types"

export class PaystackApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PaystackApiError"
  }
}

function getSecretKey() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim()

  if (!secretKey) {
    throw new PaystackApiError("Paystack is not configured.")
  }

  return secretKey
}

async function paystackRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<PaystackApiResponse<T>> {
  const response = await fetch(`${PAYSTACK_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  const payload = (await response.json()) as PaystackApiResponse<T>

  if (!payload.status) {
    throw new PaystackApiError(payload.message || "Paystack request failed.")
  }

  return payload
}

export function verifyPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature) {
    return false
  }

  const secretKey = getSecretKey()
  const hash = createHmac("sha512", secretKey).update(rawBody).digest("hex")

  return hash === signature
}

export async function verifyPaystackTransaction(reference: string) {
  const response = await paystackRequest<PaystackTransactionData>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  )

  return response.data
}

export async function initializeHostedTransaction(input: {
  email: string
  amount: number
  currency: string
  callbackUrl: string
  metadata: Record<string, string>
}) {
  const response = await paystackRequest<PaystackInitializeData>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: input.amount,
        currency: input.currency,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    },
  )

  return response.data
}
