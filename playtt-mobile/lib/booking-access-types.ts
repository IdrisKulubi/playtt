export const BOOKING_ACCESS_STATUSES = [
  "configuring",
  "ready",
  "temporarily_unavailable",
  "action_required",
  "revoking",
  "revoked",
  "expired",
  "not_eligible",
] as const

export type BookingAccessStatus = (typeof BOOKING_ACCESS_STATUSES)[number]

export type BookingAccessDoor = {
  accessPointId: string
  name: string
  kind: string
  sortOrder: number
}

export type BookingAccess = {
  bookingId: string
  status: BookingAccessStatus
  doors: BookingAccessDoor[]
  validFrom: string | null
  validUntil: string | null
  revealable: boolean
  supportMessage: string | null
  updatedAt: string
}

export type RevealedBookingAccess = {
  code: string
  validFrom: string
  validUntil: string
}
