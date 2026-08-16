export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "expired",
  "completed",
  "failed",
] as const

export const PAYMENT_STATUSES = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
] as const

export const REPLAY_STATUSES = [
  "pending",
  "processing",
  "ready",
  "failed",
  "cancelled",
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
export type ReplayStatus = (typeof REPLAY_STATUSES)[number]

export function formatUnknownEnumValue(value: string) {
  return value.replaceAll("_", " ")
}

export function isKnownBookingStatus(
  value: string,
): value is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value)
}

export function isKnownPaymentStatus(
  value: string,
): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value)
}

export function isKnownReplayStatus(value: string): value is ReplayStatus {
  return (REPLAY_STATUSES as readonly string[]).includes(value)
}
