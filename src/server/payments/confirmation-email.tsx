import BookingConfirmedEmail, { bookingConfirmedSubject } from "@/emails/booking-confirmed-email"
import { siteUrl } from "@/emails/components"
import { sendPlayttEmail } from "@/server/email/send-email"

export async function sendBookingConfirmationEmail(input: {
  email: string
  name: string
  locationName: string
  resourceName: string
  startTime: Date
  endTime: Date
  totalAmount: string
  currency: string
  idempotencyKey: string
  bookingId?: string
  timeZone?: string | null
}) {
  const props = {
    name: input.name,
    venueName: input.locationName,
    tableName: input.resourceName,
    startTime: input.startTime,
    endTime: input.endTime,
    totalAmount: input.totalAmount,
    currency: input.currency,
    timeZone: input.timeZone ?? undefined,
    bookingUrl: siteUrl(input.bookingId ? `/bookings/${input.bookingId}` : "/bookings"),
  }

  await sendPlayttEmail({
    kind: "booking confirmation",
    to: input.email,
    subject: bookingConfirmedSubject(props),
    email: <BookingConfirmedEmail {...props} />,
    idempotencyKey: input.idempotencyKey,
  })
}
