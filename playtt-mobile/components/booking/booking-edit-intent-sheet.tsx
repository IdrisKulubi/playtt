import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"

export type EditIntent = "time" | "players"

type BookingEditIntentStepProps = {
  changeTime: boolean
  addPlayers: boolean
  onToggle: (intent: EditIntent) => void
  onContinue: () => void
}

/** First step of a change: pick one or both things to change. */
export function BookingEditIntentStep({
  changeTime,
  addPlayers,
  onToggle,
  onContinue,
}: BookingEditIntentStepProps) {
  return (
    <View style={styles.stack}>
      <AppText variant="body" color="secondaryLabel">
        What do you want to change? You can pick both.
      </AppText>
      <ListSection>
        <ListRow
          icon="clock.fill"
          title="The time"
          subtitle="Pick a new time at the same venue"
          accessory={{ kind: "toggle", value: changeTime, onValueChange: () => onToggle("time") }}
        />
        <ListRow
          icon="person.2.fill"
          title="The number of players"
          subtitle="Add or remove players"
          accessory={{ kind: "toggle", value: addPlayers, onValueChange: () => onToggle("players") }}
        />
      </ListSection>
      <Button
        label="Continue"
        onPress={onContinue}
        disabled={!changeTime && !addPlayers}
        accessibilityHint={changeTime || addPlayers ? undefined : "Choose what to change first"}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.md },
})
