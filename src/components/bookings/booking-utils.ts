import { subHours } from "date-fns"

import { formatUnknownEnumValue } from "@/lib/compatibility/status-values"
import { BOOKING_EDIT_CUTOFF_HOURS, BOOKING_SLOT_INTERVAL_MINUTES } from "@/server/bookings/constants"
import type { SlotAvailability, UserBookingSummary } from "@/server/bookings/types"

export const GROUP_SIZE_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const
export type GroupSize = (typeof GROUP_SIZE_OPTIONS)[number]
export const INCLUDED_PLAYERS = 5
export const EXTRA_PLAYER_SURCHARGE = 500

export type BookingStep = "location" | "timing" | "checkout"

export function formatPricingTierLabel(
  snapshot: Record<string, unknown> | undefined
): string | null {
  if (!snapshot) return null
  const tier = snapshot.pricingTier
  if (typeof tier !== "string" || !tier.trim()) return null
  return tier
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function isSlotStartInPast(startsAtIso: string, nowMs: number): boolean {
  return (
    nowMs >=
    new Date(startsAtIso).getTime() + BOOKING_SLOT_INTERVAL_MINUTES * 60 * 1000
  )
}

export function availabilitySubtitle(
  slot: SlotAvailability,
  startInPast: boolean
): string {
  if (startInPast) return "Past"
  if (!slot.isAvailable || slot.openTableCount <= 0) return "No tables"
  if (slot.openTableCount === 1) return "1 open table"
  return `${slot.openTableCount} open tables`
}

const timeFormatter = new Intl.DateTimeFormat("en-KE", {
  hour: "numeric",
  minute: "2-digit",
})

const dateFormatter = new Intl.DateTimeFormat("en-KE", {
  weekday: "short",
  month: "short",
  day: "numeric",
})

export function needsBookingPayment(booking: UserBookingSummary) {
  return booking.status === "pending" && booking.paymentStatus === "unpaid"
}

export function canCancelBooking(booking: UserBookingSummary) {
  return booking.status === "pending" && booking.paymentStatus === "unpaid"
}

export function formatPaymentStatus(paymentStatus: string) {
  if (paymentStatus === "paid") return "Paid"
  if (paymentStatus === "unpaid") return "Unpaid"
  return formatUnknownEnumValue(paymentStatus)
}

export function formatBookingStatus(status: string, paymentStatus: string) {
  if (status === "confirmed" || paymentStatus === "paid") {
    return "Confirmed"
  }
  if (status === "pending" && paymentStatus === "unpaid") {
    return "Payment needed"
  }
  if (status === "cancelled") return "Cancelled"
  if (status === "expired") return "Expired"
  if (status === "completed") return "Completed"
  return formatUnknownEnumValue(status)
}

export function getEditWindowClosesAt(startTimeIso: string) {
  return subHours(new Date(startTimeIso), BOOKING_EDIT_CUTOFF_HOURS)
}

export function formatEditWindowClosesAt(startTimeIso: string) {
  const closesAt = getEditWindowClosesAt(startTimeIso)
  return timeFormatter.format(closesAt)
}

export function formatEditWindowLabel(booking: UserBookingSummary) {
  if (booking.editable) {
    return `Closes at ${formatEditWindowClosesAt(booking.startTime)}`
  }
  return booking.editBlockedReason ?? "Edits closed"
}

export function isSessionStartingSoon(
  startTimeIso: string,
  windowMinutes = 60,
  nowMs = Date.now(),
) {
  const startMs = new Date(startTimeIso).getTime()
  const remainingMs = startMs - nowMs
  return remainingMs > 0 && remainingMs <= windowMinutes * 60 * 1000
}

export function formatStartsInLabel(startTimeIso: string, nowMs = Date.now()) {
  const remainingMs = new Date(startTimeIso).getTime() - nowMs
  if (remainingMs <= 0) return null
  const minutes = Math.ceil(remainingMs / (60 * 1000))
  if (minutes < 60) return `Starts in ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (remainder === 0) return `Starts in ${hours}h`
  return `Starts in ${hours}h ${remainder}m`
}

export function formatPaymentCountdown(
  expiresAtIso: string | null,
  nowMs = Date.now(),
) {
  if (!expiresAtIso) return null

  const remainingMs = new Date(expiresAtIso).getTime() - nowMs

  if (remainingMs <= 0) {
    return "Hold expired"
  }

  const totalSeconds = Math.floor(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")} left to pay`
}

export function buildDirectionsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

export function formatBookingTimeRange(booking: UserBookingSummary) {
  const start = new Date(booking.startTime)
  const end = new Date(booking.endTime)
  return `${dateFormatter.format(start)}, ${timeFormatter.format(start)}-${timeFormatter.format(end)}`
}

export function formatMoney(amount: string, currency: string) {
  const value = Number(amount)
  return `${currency} ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`
}

export function canShowAccessPolicy(booking: UserBookingSummary, nowMs = Date.now()) {
  return (
    booking.status === "confirmed" &&
    booking.paymentStatus === "paid" &&
    new Date(booking.endTime).getTime() >= nowMs
  )
}

export function buildSessionShareText(booking: UserBookingSummary) {
  return [
    `PlayTT session at ${booking.locationName}`,
    formatBookingTimeRange(booking),
    `${booking.groupSize} players`,
  ].join(" · ")
}

export function isPastBooking(booking: UserBookingSummary, nowMs = Date.now()) {
  return new Date(booking.endTime).getTime() < nowMs
}
