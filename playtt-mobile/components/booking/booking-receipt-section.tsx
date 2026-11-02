import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import type { UserBookingSummary } from "@/lib/booking-types"
import { formatKes, formatPaymentStatus } from "@/lib/booking-utils"

type BookingReceiptSectionProps = {
  booking: UserBookingSummary
}

/** Receipt as plain label / value rows, total last. */
export function BookingReceiptSection({ booking }: BookingReceiptSectionProps) {
  return (
    <ListSection header="Receipt" separatorInset={16}>
      <ListRow title="Price" accessory={{ kind: "value", value: formatKes(booking.subtotalAmount, booking.currency) }} />
      <ListRow title="Payment" accessory={{ kind: "value", value: formatPaymentStatus(booking.paymentStatus) }} />
      <ListRow title="Total" accessory={{ kind: "value", value: formatKes(booking.totalAmount, booking.currency) }} />
    </ListSection>
  )
}
