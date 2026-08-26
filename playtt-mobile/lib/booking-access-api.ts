import { apiFetch } from "@/lib/api-client"
import type {
  BookingAccess,
  RevealedBookingAccess,
} from "@/lib/booking-access-types"

type AccessResponse = { data?: { access?: BookingAccess } }
type RevealResponse = { data?: RevealedBookingAccess }

export async function fetchBookingAccess(bookingId: string) {
  const response = await apiFetch<AccessResponse>(
    `/api/bookings/${encodeURIComponent(bookingId)}/access`,
  )
  if (!response.data?.access) throw new Error("Booking access response was empty.")
  return response.data.access
}

export async function revealBookingAccess(bookingId: string) {
  const response = await apiFetch<RevealResponse>(
    `/api/bookings/${encodeURIComponent(bookingId)}/access/reveal`,
    { method: "POST", headers: { "cache-control": "no-store" } },
  )
  if (!response.data?.code) throw new Error("Booking access reveal response was empty.")
  return response.data
}
