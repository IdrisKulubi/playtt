import { getBookingBootstrapData } from "@/server/bookings/service"
import { bookingJson, mapBookingServiceError } from "@/server/bookings/http"
import { resolvePublicCatalogContext } from "@/server/tenancy/session-context"

export async function GET() {
  try {
    const context = await resolvePublicCatalogContext()
    const data = await getBookingBootstrapData(context)
    return bookingJson(data)
  } catch (error) {
    return mapBookingServiceError(error)
  }
}
