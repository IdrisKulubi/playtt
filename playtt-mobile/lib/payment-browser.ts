import * as WebBrowser from "expo-web-browser"

import { getApiBaseUrl } from "@/lib/env"

/** Must match server `PAYMENT_COMPLETE_PATH`. */
export const PAYMENT_COMPLETE_PATH = "/pay/complete"

/**
 * Fallback return URL when the server does not provide one.
 * Prefer `returnUrl` from the payment init response so the host
 * matches `NEXT_PUBLIC_APP_URL` (including www).
 */
export function getPaymentReturnUrlFallback() {
  return `${getApiBaseUrl()}${PAYMENT_COMPLETE_PATH}`
}

export async function openPaymentCheckout(
  authorizationUrl: string,
  returnUrl: string,
) {
  return WebBrowser.openAuthSessionAsync(authorizationUrl, returnUrl)
}
