import * as WebBrowser from "expo-web-browser"

import { getApiBaseUrl } from "@/lib/env"

/** Must match server `PAYMENT_COMPLETE_PATH` and `NEXT_PUBLIC_APP_URL` origin. */
export const PAYMENT_COMPLETE_PATH = "/pay/complete"

/**
 * Return URL for expo-web-browser after Paystack checkout.
 * `EXPO_PUBLIC_API_URL` must use the same host as `NEXT_PUBLIC_APP_URL`
 * (including www) or the in-app browser may not auto-dismiss.
 */
export function getPaymentReturnUrl() {
  return `${getApiBaseUrl()}${PAYMENT_COMPLETE_PATH}`
}

export async function openPaymentCheckout(authorizationUrl: string) {
  return WebBrowser.openAuthSessionAsync(
    authorizationUrl,
    getPaymentReturnUrl(),
  )
}
