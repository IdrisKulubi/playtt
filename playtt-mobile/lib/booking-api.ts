import { apiFetch } from "@/lib/api-client"
import type {
  BookingQuote,
  CreateBookingResult,
  LocationSummary,
  SlotAvailability,
  UserBookingSummary,
} from "@/lib/booking-types"

type BootstrapResponse = { data?: { locations: LocationSummary[] } }
type AvailabilityResponse = { data?: { slots: SlotAvailability[] } }
type QuoteResponse = { data?: { quote: BookingQuote } }
type CreateResponse = { data?: CreateBookingResult }
type MineResponse = { data?: { bookings: UserBookingSummary[] } }
type DetailResponse = { data?: { booking: UserBookingSummary } }

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
