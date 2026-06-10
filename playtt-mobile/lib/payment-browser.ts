import * as WebBrowser from "expo-web-browser"

import { getApiBaseUrl } from "@/lib/env"

export function getPaymentReturnUrl() {
  return `${getApiBaseUrl()}/pay/complete`
}

export async function openPaymentCheckout(authorizationUrl: string) {
  return WebBrowser.openAuthSessionAsync(
    authorizationUrl,
    getPaymentReturnUrl(),
  )
}
