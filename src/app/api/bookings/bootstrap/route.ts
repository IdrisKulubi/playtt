import { getBookingBootstrapData } from "@/server/bookings/service"
import { bookingJson, mapBookingServiceError } from "@/server/bookings/http"

export async function GET() {
  try {
    const data = await getBookingBootstrapData()
    return bookingJson(data)
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
