import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"

/** Explains the two things you can buy, so nobody pays for the wrong one. */
export function CoachProductSplit() {
  return (
    <ListSection header="Two different things">
      <ListRow
        icon="film.stack"
        title="Replay packs"
        subtitle="Save the last 30 seconds when you press Replay at the venue."
      />
      <ListRow
        icon="sparkles"
        tone="success"
        title="Coach"
        subtitle="Looks at your replays and suggests drills to practise. Sold separately."
      />
    </ListSection>
  )
}
