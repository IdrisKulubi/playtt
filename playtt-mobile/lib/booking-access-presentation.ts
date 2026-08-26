import type { BookingAccessStatus } from "@/lib/booking-access-types"

const PRESENTATION: Record<
  BookingAccessStatus,
  { title: string; body: string; tone: "neutral" | "positive" | "warning" }
> = {
  configuring: { title: "Preparing your entry code", body: "We are securely configuring access for every door on your route.", tone: "neutral" },
  ready: { title: "Your entry code is ready", body: "Reveal it only when you need to enter the venue.", tone: "positive" },
  temporarily_unavailable: { title: "Access is temporarily unavailable", body: "Refresh in a moment. Your booking is still confirmed.", tone: "warning" },
  action_required: { title: "We need to help with access", body: "Your booking is confirmed, but the entry setup needs support.", tone: "warning" },
  revoking: { title: "Removing venue access", body: "The entry code is being removed from the venue doors.", tone: "neutral" },
  revoked: { title: "Entry code revoked", body: "This code can no longer be used to enter the venue.", tone: "neutral" },
  expired: { title: "Entry code expired", body: "The access window for this booking has ended.", tone: "neutral" },
  not_eligible: { title: "Entry code not available", body: "Access is created after this booking is confirmed and paid.", tone: "neutral" },
}

export function getBookingAccessPresentation(status: BookingAccessStatus) {
  return PRESENTATION[status]
}

export function formatAccessWindow(validFrom: string | null, validUntil: string | null) {
  if (!validFrom || !validUntil) return null
  const from = new Date(validFrom)
  const until = new Date(validUntil)
  if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) return null
  return `${from.toLocaleString("en-KE", { weekday: "short", hour: "numeric", minute: "2-digit" })} – ${until.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" })}`
}
