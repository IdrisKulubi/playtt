import {
  EmailBookingPass,
  EmailButton,
  EmailHero,
  EmailLayout,
  EmailText,
  firstName,
  formatDay,
  formatTimeRange,
} from "@/emails/components"

export interface BookingTableChangedEmailProps {
  name: string
  venueName: string
  tableName: string
  previousTableName?: string
  startTime: Date
  endTime: Date
  timeZone?: string
  bookingUrl: string
}

export const bookingTableChangedSubject = (props: Pick<BookingTableChangedEmailProps, "tableName">) =>
  `Your PlayTT booking is now on ${props.tableName}`

export default function BookingTableChangedEmail(props: BookingTableChangedEmailProps) {
  const day = formatDay(props.startTime, props.timeZone)
  const time = formatTimeRange(props.startTime, props.endTime, props.timeZone)

  return (
    <EmailLayout preview={`Same venue, same time: ${day}, ${time}.`}>
      <EmailHero
        eyebrow="Table changed"
        title={`You're now on ${props.tableName}.`}
        lede={`Hi ${firstName(props.name)}, we moved your booking so replays and the scoreboard work for your whole session. Same venue, same time.`}
      />
      <EmailBookingPass
        venueName={props.venueName}
        tableName={props.tableName}
        note={props.previousTableName ? `Was ${props.previousTableName}` : undefined}
        day={day}
        time={time}
      />
      <EmailButton href={props.bookingUrl}>View booking</EmailButton>
      <EmailText muted>Nothing else changes, and there&apos;s nothing you need to do.</EmailText>
    </EmailLayout>
  )
}

BookingTableChangedEmail.PreviewProps = {
  name: "Amina Otieno",
  venueName: "PlayTT Hurlingham",
  tableName: "Table 1",
  previousTableName: "Table 2",
  startTime: new Date("2026-11-27T15:00:00Z"),
  endTime: new Date("2026-11-27T16:00:00Z"),
  bookingUrl: "https://www.theplaytt.com/bookings",
} satisfies BookingTableChangedEmailProps
