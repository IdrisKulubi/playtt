import { apiFetch } from "@/lib/api-client"
import type {
  BookingQuote,
  CreateBookingResult,
  InitiatePaymentResult,
  LocationSummary,
  PaymentMethodChoice,
  SlotAvailability,
  UserBookingSummary,
} from "@/lib/booking-types"

type BootstrapResponse = { data?: { locations: LocationSummary[] } }
type AvailabilityResponse = { data?: { slots: SlotAvailability[] } }
type QuoteResponse = { data?: { quote: BookingQuote } }
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
  durationMinutes: 30 | 60
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
  durationMinutes: 30 | 60
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

export async function createBooking(input: {
  locationId: string
  resourceId: string
  startTimeIso: string
  durationMinutes: 30 | 60
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

export async function fetchMyBookings(filter: "all" | "upcoming" | "past" = "all") {
  const response = await apiFetch<MineResponse>(
    `/api/bookings/mine?filter=${filter}`,
  )
  return response.data?.bookings ?? []
}

export async function fetchBookingById(bookingId: string) {
  const response = await apiFetch<DetailResponse>(`/api/bookings/${bookingId}`)
  return response.data?.booking ?? null
}

export async function initiateBookingPayment(
  bookingId: string,
  input?: {
    method?: PaymentMethodChoice
    phone?: string
  },
) {
  const body: { method?: PaymentMethodChoice; phone?: string } = {}

  if (input?.method) {
    body.method = input.method
  }

  if (input?.phone?.trim()) {
    body.phone = input.phone.trim()
  }

  const response = await apiFetch<PaymentInitResponse>(
    `/api/bookings/${bookingId}/pay`,
    {
      method: "POST",
      body: JSON.stringify(body),
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
