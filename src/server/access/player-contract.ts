export const BOOKING_ACCESS_STATES = [
  "configuring",
  "ready",
  "temporarily_unavailable",
  "action_required",
  "revoking",
  "revoked",
  "expired",
  "not_eligible",
] as const

export type BookingAccessState = (typeof BOOKING_ACCESS_STATES)[number]

export type BookingAccessDoor = {
  accessPointId: string
  name: string
  kind: "entrance" | "hall" | "resource"
  sortOrder: number
}

export type BookingAccessStatus = {
  bookingId: string
  status: BookingAccessState
  doors: BookingAccessDoor[]
  validFrom: string | null
  validUntil: string | null
  revealable: boolean
  supportMessage: string | null
  updatedAt: string
}

export type BookingAccessReveal = {
  code: string
  validFrom: string
  validUntil: string
}

export function bookingAccessNoStoreHeaders() {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    Vary: "Cookie, Authorization, x-tenant-id",
  }
}
