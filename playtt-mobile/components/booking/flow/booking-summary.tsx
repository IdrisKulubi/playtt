import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"

type BookingSummaryProps = {
  header?: string
  venue: string
  startIso: string
  endIso: string
  players: number
  /** Already formatted, e.g. "KES 1,600". */
  total?: string
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" })
}

/** The booking as a short list people can check line by line. */
export function BookingSummary({ header, venue, startIso, endIso, players, total }: BookingSummaryProps) {
  return (
    <ListSection header={header}>
      <ListRow icon="location.fill" title="Where" subtitle={venue} />
      <ListRow icon="calendar" title="Day" subtitle={formatDay(startIso)} />
      <ListRow icon="clock.fill" title="Time" subtitle={`${formatTime(startIso)} to ${formatTime(endIso)}`} />
      <ListRow icon="person.2.fill" title="Players" subtitle={`${players} players`} />
      {total ? <ListRow icon="checkmark" tone="success" title="Total" accessory={{ kind: "value", value: total }} /> : null}
    </ListSection>
  )
}
