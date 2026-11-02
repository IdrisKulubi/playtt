import { CalendarStar } from "phosphor-react-native/src/icons/CalendarStar"
import { StyleSheet, View } from "react-native"

import { formatNairobiClock } from "@/components/community/player-card/card-tiers"
import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { chatDayLabel } from "@/lib/community-chat-merge"
import type { CommunityEvent } from "@/lib/community-types"

type EventsSectionProps = {
  events: CommunityEvent[]
  onJoin: (event: CommunityEvent) => void
  onOpen: (event: CommunityEvent) => void
}

/** Upcoming events at my venue, e.g. "King of the Table · Fri 7 PM", each with one clear button. */
export function EventsSection({ events, onJoin, onOpen }: EventsSectionProps) {
  const { colors } = useAppTheme()

  if (events.length === 0) return null

  return (
    <View style={styles.root}>
      <AppText variant="title2" accessibilityRole="header">
        Events this week
      </AppText>
      {events.map((event) => {
        const full = event.maxMembers !== null && event.memberCount >= event.maxMembers
        const when = event.startsAt ? `${chatDayLabel(event.startsAt)} · ${formatNairobiClock(event.startsAt)}` : null
        const going = `${event.memberCount}${event.maxMembers ? ` of ${event.maxMembers}` : ""} going`

        return (
          <Card key={event.id}>
            <View style={styles.stack}>
              <View style={styles.top}>
                <CalendarStar size={22} color={colors.warning} weight="fill" />
                <AppText variant="headline" style={styles.flex}>
                  {event.title}
                </AppText>
              </View>
              {when ? (
                <AppText variant="callout" weight="600" color="warning">
                  {when}
                </AppText>
              ) : null}
              {event.description ? (
                <AppText variant="callout" color="secondaryLabel" numberOfLines={3}>
                  {event.description}
                </AppText>
              ) : null}
              <AppText variant="footnote" color="secondaryLabel">
                {full && !event.joined ? `${going} · Full` : going}
              </AppText>
              {event.joined ? (
                <Button
                  label="You're going · Open chat"
                  variant="secondary"
                  accessibilityLabel={`You're going to ${event.title}. Open the event chat`}
                  onPress={() => onOpen(event)}
                  style={styles.action}
                />
              ) : full ? null : (
                <Button
                  label="Join"
                  accessibilityLabel={`Join ${event.title}`}
                  onPress={() => onJoin(event)}
                  style={styles.action}
                />
              )}
            </View>
          </Card>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: PlayTTSpacing.sm },
  stack: { gap: PlayTTSpacing["2xs"] },
  top: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.xs },
  flex: { flex: 1 },
  action: { marginTop: PlayTTSpacing.sm },
})
