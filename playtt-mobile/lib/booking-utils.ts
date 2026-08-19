import type { SlotAvailability, UserBookingSummary } from "@/lib/booking-types"

export const INCLUDED_PLAYERS = 5
export const EXTRA_PLAYER_SURCHARGE = 500

export function extraPlayerSurcharge(groupSize: number) {
  return Math.max(0, groupSize - INCLUDED_PLAYERS) * EXTRA_PLAYER_SURCHARGE
}

export function isSlotStartInPast(startsAtIso: string, nowMs = Date.now()) {
  const slotIntervalMs = 30 * 60 * 1000
  return nowMs >= new Date(startsAtIso).getTime() + slotIntervalMs
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

export function formatPaymentCountdown(expiresAtIso: string | null, nowMs = Date.now()) {
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

export function formatKes(amount: number | string, currency = "KES") {
  const value = typeof amount === "string" ? Number(amount) : amount
  return `${currency} ${value.toLocaleString("en-KE")}`
}

export function formatBookingStatus(status: string, paymentStatus: string) {
  if (status === "confirmed" || paymentStatus === "paid") {
    return "Confirmed — see you at the pod"
  }
  if (status === "pending" && paymentStatus === "unpaid") {
    return "Complete M-Pesa payment to confirm your booking."
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

/** Seven-day strip centered on anchor (3 days before through 3 after, clamped to today). */
export function buildDateStripAround(anchor: Date, daysAhead = 7) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const anchorDay = new Date(anchor)
  anchorDay.setHours(0, 0, 0, 0)

  const half = Math.floor(daysAhead / 2)
  let start = new Date(anchorDay)
  start.setDate(anchorDay.getDate() - half)

  if (start < today) {
    start = new Date(today)
  }

  const days: Date[] = []
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

export function formatDateChipLabel(date: Date, now = new Date()) {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const target = new Date(date)
  target.setHours(0, 0, 0, 0)

  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  )

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"

  return date.toLocaleDateString("en-KE", { weekday: "short" })
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function formatSlotSummary(
  startsAt: string,
  durationMinutes: number,
  amount: number | string,
  currency = "KES",
) {
  const start = new Date(startsAt)
  const dayLabel = start.toLocaleDateString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
  const timeLabel = start.toLocaleTimeString("en-KE", {
    hour: "numeric",
    minute: "2-digit",
  })
  const price =
    typeof amount === "string" ? Number(amount) : amount

  return `${dayLabel} · ${timeLabel} · ${durationMinutes} min · ${currency} ${price.toLocaleString("en-KE")}`
}

export function formatTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const time = (value: Date) =>
    value.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" })
  return `${time(start)} – ${time(end)}`
}

export function formatTimeOfDayGreeting(now = new Date()) {
  const hour = now.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function formatRelativeSessionStart(
  startIso: string,
  nowMs = Date.now(),
) {
  const start = new Date(startIso)
  const now = new Date(nowMs)

  const startDay = new Date(start)
  startDay.setHours(0, 0, 0, 0)

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.round(
    (startDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  )

  const timeLabel = start.toLocaleTimeString("en-KE", {
    hour: "numeric",
    minute: "2-digit",
  })

  if (diffDays === 0) {
    const minutesUntil = Math.ceil((start.getTime() - nowMs) / (60 * 1000))
    if (minutesUntil > 0 && minutesUntil < 60) {
      return `Starts in ${minutesUntil} min`
    }
    return `Today at ${timeLabel}`
  }

  if (diffDays === 1) return `Tomorrow at ${timeLabel}`
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`

  return start.toLocaleDateString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export function isSessionWithinCountdownWindow(
  startIso: string,
  nowMs = Date.now(),
) {
  const start = new Date(startIso)
  const now = new Date(nowMs)

  const startDay = new Date(start)
  startDay.setHours(0, 0, 0, 0)

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.round(
    (startDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  )

  return diffDays >= 0 && diffDays <= 7
}

export function formatSessionCountdownLabel(
  startIso: string,
  nowMs = Date.now(),
) {
  const start = new Date(startIso)
  const now = new Date(nowMs)

  const startDay = new Date(start)
  startDay.setHours(0, 0, 0, 0)

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.round(
    (startDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  )

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`

  return start.toLocaleDateString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export function formatTicketTimeLine(
  startIso: string,
  endIso: string,
  nowMs = Date.now(),
) {
  if (isSessionWithinCountdownWindow(startIso, nowMs)) {
    return formatTimeRange(startIso, endIso)
  }

  return formatRelativeSessionStart(startIso, nowMs)
}

export function formatTicketStatusLine(booking: UserBookingSummary) {
  const players = `${booking.groupSize} players`
  const duration = `${booking.durationMinutes} min`

  if (booking.status === "confirmed" || booking.paymentStatus === "paid") {
    return `Confirmed · ${players} · ${duration}`
  }

  if (booking.status === "pending" && booking.paymentStatus === "unpaid") {
    return `Awaiting payment · ${players} · ${duration}`
  }

  return `${players} · ${duration}`
}

export function needsBookingPayment(booking: UserBookingSummary) {
  return booking.status === "pending" && booking.paymentStatus === "unpaid"
}

export function canShowEntryCodeTeaser(
  booking: UserBookingSummary,
  nowMs = Date.now(),
) {
  return (
    canShowAccessCard(booking, nowMs) &&
    isSessionWithinCountdownWindow(booking.startTime, nowMs)
  )
}

export function isEntryCodeTeaserDay(startIso: string, nowMs = Date.now()) {
  const start = new Date(startIso)
  const now = new Date(nowMs)

  const startDay = new Date(start)
  startDay.setHours(0, 0, 0, 0)

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  return startDay.getTime() === today.getTime()
}

export function formatLastSessionLabel(booking: UserBookingSummary) {
  const playedOn = new Date(booking.endTime).toLocaleDateString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })

  return `Last played ${playedOn} · ${booking.locationName}`
}

export function formatSecondSessionLabel(booking: UserBookingSummary) {
  const relative = formatRelativeSessionStart(booking.startTime)
  return `${relative} · ${booking.locationName}`
}

/** Off-peak 60 min at base group size — mirrors server pricing floor. */
export const DEFAULT_STARTING_PRICE_KES = 1600

export function isPastBooking(booking: UserBookingSummary, nowMs = Date.now()) {
  return new Date(booking.endTime).getTime() < nowMs
}

export function isUpcomingBooking(
  booking: UserBookingSummary,
  nowMs = Date.now(),
) {
  return (
    !isPastBooking(booking, nowMs) &&
    booking.status !== "cancelled" &&
    booking.status !== "expired"
  )
}

export function canCancelBooking(booking: UserBookingSummary) {
  return booking.status === "pending" && booking.paymentStatus === "unpaid"
}

export function canShowAccessCard(booking: UserBookingSummary, nowMs = Date.now()) {
  return (
    booking.status === "confirmed" &&
    booking.paymentStatus === "paid" &&
    isUpcomingBooking(booking, nowMs)
  )
}

export function formatPaymentStatus(paymentStatus: string) {
  if (paymentStatus === "paid") return "Paid"
  if (paymentStatus === "unpaid") return "Unpaid"
  return paymentStatus.replaceAll("_", " ")
}
