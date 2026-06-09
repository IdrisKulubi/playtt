export type ResourceSummary = {
  id: string
  locationId: string
  name: string
  slug: string
  type: string
  capacity: number
}

export type LocationSummary = {
  id: string
  name: string
  slug: string
  timezone: string
  address: string
  resources: ResourceSummary[]
}

export type SlotAvailability = {
  startsAt: string
  endsAt: string
  durationMinutes: number
  isAvailable: boolean
  openTableCount: number
  availableResourceIds: string[]
  price: {
    currency: string
    subtotalAmount: number
    discountAmount: number
    totalAmount: number
    pricingRuleSnapshot: Record<string, unknown>
  }
}

export type BookingQuote = {
  locationId: string
  resourceId: string
  groupSize: number
  durationMinutes: number
  startTimeIso: string
  endTimeIso: string
  currency: string
  subtotalAmount: number
  surchargeAmount: number
  discountAmount: number
  totalAmount: number
  pricingRuleSnapshot: Record<string, unknown>
}

export type CreateBookingResult = {
  bookingId: string
  status: string
  paymentStatus: string
  totalAmount: string
  currency: string
  expiresAt: string | null
}

export type UserBookingSummary = {
  id: string
  status: string
  paymentStatus: string
  startTime: string
  endTime: string
  durationMinutes: number
  currency: string
  totalAmount: string
  locationId: string
  locationName: string
  resourceId: string
  resourceName: string
  expiresAt: string | null
  notes: string | null
}

export type BookingStep = "location" | "timing" | "checkout" | "confirmed"

export const GROUP_SIZE_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const
export type GroupSize = (typeof GROUP_SIZE_OPTIONS)[number]
