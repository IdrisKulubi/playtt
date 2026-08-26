export function bookingIdFromNotificationData(data: unknown) {
  if (!data || typeof data !== "object") return null
  const bookingId = (data as Record<string, unknown>).bookingId
  return typeof bookingId === "string" && bookingId.length > 0 ? bookingId : null
}
