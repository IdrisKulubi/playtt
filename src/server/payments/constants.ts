export const PAYSTACK_API_BASE_URL = "https://api.paystack.co"

export const PAYSTACK_MPESA_PROVIDER = "mpesa" as const

export const PAYSTACK_CURRENCY = "KES"

export function getAppBaseUrl() {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:3000"

  return base.replace(/\/+$/, "")
}

export const PAYMENT_COMPLETE_PATH = "/pay/complete"

export function getPaymentCallbackUrl(bookingId: string) {
  const params = new URLSearchParams({ bookingId })
  return `${getAppBaseUrl()}${PAYMENT_COMPLETE_PATH}?${params.toString()}`
}

/** Paystack amounts are in the smallest currency unit (cents for KES). */
export function kesToPaystackAmount(totalKes: string | number): number {
  const value = typeof totalKes === "string" ? Number(totalKes) : totalKes

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Payment amount must be greater than zero.")
  }

  return Math.round(value * 100)
}
