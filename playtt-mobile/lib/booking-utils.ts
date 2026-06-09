import type { SlotAvailability } from "@/lib/booking-types"

export function isSlotStartInPast(startsAtIso: string, nowMs = Date.now()) {
  return new Date(startsAtIso).getTime() <= nowMs
}

export function formatPricingTierLabel(
  snapshot: Record<string, unknown> | undefined,
) {
  if (!snapshot) return null
  const tier = snapshot.pricingTier
  if (typeof tier !== "string" || !tier.trim()) return null
  return tier
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function slotSubtitle(slot: SlotAvailability, nowMs = Date.now()) {
  if (isSlotStartInPast(slot.startsAt, nowMs)) return "Past"
  if (!slot.isAvailable || slot.openTableCount <= 0) return "No tables"
  if (slot.openTableCount === 1) return "1 open table"
  return `${slot.openTableCount} open tables`
}

export function formatKes(amount: number | string, currency = "KES") {
  const value = typeof amount === "string" ? Number(amount) : amount
  return `${currency} ${value.toLocaleString("en-KE")}`
}

export function formatBookingStatus(status: string, paymentStatus: string) {
  if (status === "confirmed") return "Confirmed — see you at the pod"
  if (status === "pending" && paymentStatus === "unpaid") {
    return "Reserved — payment coming soon. We'll confirm your slot."
  }
  if (status === "cancelled") return "Cancelled"
  if (status === "expired") return "Expired"
  if (status === "completed") return "Completed"
  return status.replaceAll("_", " ")
}

export function buildDateStrip(daysAhead = 7) {
  const days: Date[] = []
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  for (let index = 0; index < daysAhead; index += 1) {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    days.push(day)
  }

  return days
}

export function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const time = (value: Date) =>
    value.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" })
  return `${time(start)} – ${time(end)}`
}
