const PLAYTT_SCHEME = "playtt"

export function getPlayttDeepLink(path: string) {
  return `${PLAYTT_SCHEME}://${path.replace(/^\//, "")}`
}

export function getPaymentCompleteDeepLink(bookingId?: string | null) {
  if (bookingId) {
    return getPlayttDeepLink(`booking/${bookingId}`)
  }

  return getPlayttDeepLink("bookings")
}
