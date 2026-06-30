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
  groupSize: number
  currency: string
  subtotalAmount: string
  totalAmount: string
  locationId: string
  locationName: string
  resourceId: string
  resourceName: string
  expiresAt: string | null
  notes: string | null
  editable: boolean
  editBlockedReason: string | null
}

export type ModificationPreview = {
  currentTotal: string
  newTotal: string
  deltaAmount: string
  creditAmount: string
  requiresPayment: boolean
  changeType: string
  newGroupSize: number
  newStartTime: string
  newEndTime: string
  newResourceId: string
  newResourceName: string
  currency: string
}

export type ModificationApplyResult = {
  modificationId: string
  status: "applied" | "pending_payment"
  deltaAmount: string
  creditAmount: string
  requiresPayment: boolean
  authorizationUrl?: string
  returnUrl?: string
  displayText?: string
}

export type InitiatePaymentResult = {
  method: "hosted"
  reference: string
  status: string
  displayText: string
  expiresAt: string | null
  bookingId: string
  returnUrl: string
  authorizationUrl?: string
}

export type PaymentStatusResult = {
  bookingId: string
  bookingStatus: string
  paymentStatus: string
  reference: string | null
  providerStatus: string | null
  displayText: string | null
  expiresAt: string | null
}

export type BookingStep = "location" | "timing" | "pay" | "confirmed"

export const GROUP_SIZE_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const
export type GroupSize = (typeof GROUP_SIZE_OPTIONS)[number]
