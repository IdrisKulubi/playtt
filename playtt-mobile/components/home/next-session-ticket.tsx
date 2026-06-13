import { BookingSessionCard } from "@/components/booking/booking-session-card"
import type { UserBookingSummary } from "@/lib/booking-types"

type NextSessionTicketProps = {
  booking: UserBookingSummary
  onPress: () => void
  embedded?: boolean
}

export function NextSessionTicket({
  booking,
  onPress,
  embedded = false,
}: NextSessionTicketProps) {
  return (
    <BookingSessionCard
      booking={booking}
      onPress={onPress}
      embedded={embedded}
      useTicketTimeLine
    />
  )
}
