import {
  EmailBookingPass,
  EmailButton,
  EmailDetails,
  EmailHero,
  EmailLayout,
  EmailTips,
  firstName,
  formatDay,
  formatDuration,
  formatMoney,
  formatTimeRange,
} from "@/emails/components"

export interface BookingConfirmedEmailProps {
  name: string
  venueName: string
  tableName: string
  startTime: Date
  endTime: Date
  totalAmount: string
  currency: string
  timeZone?: string
  /** Opens the booking in PlayTT. */
  bookingUrl: string
}

export const bookingConfirmedSubject = (props: Pick<BookingConfirmedEmailProps, "venueName">) =>
  `You're booked at ${props.venueName}`

export default function BookingConfirmedEmail(props: BookingConfirmedEmailProps) {
  const { startTime, endTime, timeZone } = props
  const day = formatDay(startTime, timeZone)
  const time = formatTimeRange(startTime, endTime, timeZone)

  return (
    <EmailLayout preview={`${props.tableName} · ${day}, ${time}. See you on the table.`}>
      <EmailHero
        eyebrow="Booking confirmed"
        title={`You're booked, ${firstName(props.name)}.`}
        lede="Your table is reserved. See you there."
      />
      <EmailBookingPass venueName={props.venueName} tableName={props.tableName} day={day} time={time} />
      <EmailDetails
        rows={[
          { label: "Length", value: formatDuration(startTime, endTime) },
          { label: "Paid", value: formatMoney(props.totalAmount, props.currency) },
        ]}
      />
      <EmailButton href={props.bookingUrl}>View booking</EmailButton>
      <EmailTips
        title="At the table"
        items={[
          "Arrive a few minutes early. Your session starts and ends on time.",
          "Tap Replay on the tablet to save a great rally. It plays on the TV and lands in your library.",
          "Start a match on the tablet to put names and the score on the TV.",
        ]}
      />
    </EmailLayout>
  )
}

BookingConfirmedEmail.PreviewProps = {
  name: "Amina Otieno",
  venueName: "PlayTT Hurlingham",
  tableName: "Table 1",
  startTime: new Date("2026-11-27T15:00:00Z"),
  endTime: new Date("2026-11-27T16:00:00Z"),
  totalAmount: "2400.00",
  currency: "KES",
  bookingUrl: "https://www.theplaytt.com/bookings",
} satisfies BookingConfirmedEmailProps
