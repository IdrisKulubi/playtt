import { apiFetch } from "@/lib/api-client"
import type {
  BookingPlan,
  BookingQuote,
  CreateBookingResult,
  InitiatePaymentResult,
  LocationSummary,
  ModificationApplyResult,
  ModificationPreview,
  SlotAvailability,
  UserBookingSummary,
} from "@/lib/booking-types"
import {
  DEFAULT_STARTING_PRICE_KES,
  formatKes,
  isSlotStartInPast,
  toDateKey,
} from "@/lib/booking-utils"

type BootstrapResponse = { data?: { locations: LocationSummary[] } }
type AvailabilityResponse = { data?: { slots: SlotAvailability[] } }
type QuoteResponse = { data?: { quote: BookingQuote } }
type PlanResponse = { data?: { plan: BookingPlan } }
type CreateResponse = { data?: CreateBookingResult }
type MineResponse = { data?: { bookings: UserBookingSummary[] } }
type DetailResponse = { data?: { booking: UserBookingSummary } }
type PaymentInitResponse = { data?: InitiatePaymentResult }
type PaymentStatusResponse = {
  data?: {
    bookingId: string
    bookingStatus: string
    paymentStatus: string
    reference: string | null
    providerStatus: string | null
    displayText: string | null
    expiresAt: string | null
  }
}

export async function fetchBookingBootstrap() {
  const response = await apiFetch<BootstrapResponse>("/api/bookings/bootstrap")
  return response.data?.locations ?? []
}

export async function fetchAvailability(input: {
  locationId: string
  date: string
  durationMinutes: number
  groupSize: number
}) {
  const params = new URLSearchParams({
    locationId: input.locationId,
    date: input.date,
    durationMinutes: String(input.durationMinutes),
    groupSize: String(input.groupSize),
  })
  const response = await apiFetch<AvailabilityResponse>(
    `/api/bookings/availability?${params.toString()}`,
  )
  return response.data?.slots ?? []
}

export async function fetchBookingQuote(input: {
  locationId: string
  resourceId: string
  startTimeIso: string
  durationMinutes: number
  groupSize: number
}) {
  const params = new URLSearchParams({
    locationId: input.locationId,
    resourceId: input.resourceId,
    startTimeIso: input.startTimeIso,
    durationMinutes: String(input.durationMinutes),
    groupSize: String(input.groupSize),
  })
  const response = await apiFetch<QuoteResponse>(
    `/api/bookings/quote?${params.toString()}`,
  )
  return response.data?.quote ?? null
}

/**
 * Checks any start time (5-minute steps) across the venue's tables. Free:
 * returns the table and price. Clashing or past: busy times plus the nearest
 * times that work.
 */
export async function fetchBookingPlan(input: {
  locationId: string
  startTimeIso: string
  durationMinutes: number
  groupSize: number
}) {
  const params = new URLSearchParams({
    locationId: input.locationId,
    startTimeIso: input.startTimeIso,
    durationMinutes: String(input.durationMinutes),
    groupSize: String(input.groupSize),
  })
  const response = await apiFetch<PlanResponse>(`/api/bookings/plan?${params.toString()}`)
  if (!response.data?.plan) throw new Error("Could not check that time.")
  return response.data.plan
}

export async function createBooking(input: {
  locationId: string
  resourceId: string
  startTimeIso: string
  durationMinutes: number
  groupSize: number
  notes?: string
}) {
  const response = await apiFetch<CreateResponse>("/api/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  })

  if (!response.data) {
    throw new Error("Booking response was empty.")
  }

  return response.data
}

type ModificationQuoteResponse = {
  data?: { modificationPreview: ModificationPreview }
}
type ModificationApplyResponse = { data?: ModificationApplyResult }
type ModificationStatusResponse = {
  data?: { modificationId: string; status: string; applied: boolean }
}

export async function fetchMyBookings(filter: "all" | "upcoming" | "past" = "upcoming") {
  const response = await apiFetch<MineResponse>(
    `/api/bookings/mine?filter=${filter}`,
  )
  return response.data?.bookings ?? []
}

export async function fetchStartingPriceHint() {
  try {
    const locations = await fetchBookingBootstrap()
    const location = locations[0]
    if (!location) {
      return `From ${formatKes(DEFAULT_STARTING_PRICE_KES)} per session`
    }

    const slots = await fetchAvailability({
      locationId: location.id,
      date: toDateKey(new Date()),
      durationMinutes: 60,
      groupSize: 2,
    })

    const available = slots.filter(
      (slot) =>
        slot.isAvailable &&
        slot.openTableCount > 0 &&
        !isSlotStartInPast(slot.startsAt),
    )

    if (available.length === 0) {
      return `From ${formatKes(DEFAULT_STARTING_PRICE_KES)} per session`
    }

    const minAmount = Math.min(
      ...available.map((slot) => slot.price.totalAmount),
    )

    return `From ${formatKes(minAmount)} per session`
  } catch {
    return `From ${formatKes(DEFAULT_STARTING_PRICE_KES)} per session`
  }
}

export async function fetchBookingById(bookingId: string) {
  const response = await apiFetch<DetailResponse>(`/api/bookings/${bookingId}`)
  return response.data?.booking ?? null
}

export async function initiateBookingPayment(bookingId: string) {
  const response = await apiFetch<PaymentInitResponse>(
    `/api/bookings/${bookingId}/pay`,
    {
      method: "POST",
      body: JSON.stringify({ client: "mobile" }),
    },
  )

  if (!response.data) {
    throw new Error("Payment response was empty.")
  }

  return response.data
}

export async function fetchBookingPaymentStatus(bookingId: string) {
  const response = await apiFetch<PaymentStatusResponse>(
    `/api/bookings/${bookingId}/payment`,
  )

  return response.data ?? null
}

export async function cancelBooking(bookingId: string) {
  await apiFetch(`/api/bookings/${bookingId}/cancel`, {
    method: "POST",
  })
}

export async function quoteBookingModification(
  bookingId: string,
  body: {
    startTimeIso?: string
    groupSize?: number
    notes?: string
  },
) {
  const response = await apiFetch<ModificationQuoteResponse>(
    `/api/bookings/${bookingId}/modifications/quote`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  )

  return response.data?.modificationPreview ?? null
}

export async function applyBookingModification(
  bookingId: string,
  body: {
    startTimeIso?: string
    groupSize?: number
    notes?: string
  },
) {
  const response = await apiFetch<ModificationApplyResponse>(
    `/api/bookings/${bookingId}/modifications/apply`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  )

  if (!response.data) {
    throw new Error("Modification response was empty.")
  }

  return response.data
}

export async function fetchModificationStatus(
  bookingId: string,
  modificationId: string,
) {
  const response = await apiFetch<ModificationStatusResponse>(
    `/api/bookings/${bookingId}/modifications/${modificationId}`,
  )

  return response.data ?? null
}
