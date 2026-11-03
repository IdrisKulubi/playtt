import { type Href, router } from "expo-router"
import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { EmptyState } from "@/components/kit/empty-state"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { Screen } from "@/components/kit/screen"
import { Sheet } from "@/components/kit/sheet"
import { StepHeader } from "@/components/kit/step-header"
import { AppText } from "@/components/ui/app-text"
import { TypeScale, type TypeVariant } from "@/constants/type"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { haptics } from "@/lib/haptics"
import { toast } from "@/lib/toast"

/**
 * Redesign Phase 1 gate: every kit component on one screen, to review on a
 * real iPhone and Android phone (light, dark, large text, reduced motion).
 * Reachable from Me → Settings → Design kit in development builds only.
 */

const VARIANTS = Object.keys(TypeScale) as TypeVariant[]
const STEP_TITLES = ["Pick a day", "Pick a time", "How many players?"]

export default function KitDemoScreen() {
  const [step, setStep] = useState(1)
  const [reminders, setReminders] = useState(true)
  const [loading, setLoading] = useState(false)
  const [sheet, setSheet] = useState<"detents" | "scroll" | "locked" | null>(null)

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(app)/account" as Href))

  return (
    <Screen
      title="Design kit"
      subtitle="Every redesign component in one place"
      back={{ label: "Me", onPress: back }}
      footer={
        <View style={styles.footerRow}>
          <AppText variant="headline" tabular>
            KSh 1,200
          </AppText>
          <Button label="Continue" onPress={() => haptics.success()} fullWidth={false} />
        </View>
      }
    >
      <Card>
        <StepHeader step={step} total={STEP_TITLES.length} title={STEP_TITLES[step - 1]} />
        <View style={styles.row}>
          <Button
            label="Back"
            variant="secondary"
            fullWidth={false}
            disabled={step === 1}
            onPress={() => setStep((s) => Math.max(1, s - 1))}
          />
          <Button
            label="Next step"
            fullWidth={false}
            disabled={step === STEP_TITLES.length}
            onPress={() => setStep((s) => Math.min(STEP_TITLES.length, s + 1))}
          />
        </View>
      </Card>

      <ListSection header="Buttons" separatorInset={PlayTTSpacing.md}>
        <View style={styles.stack}>
          <Button label="Book a table" onPress={() => haptics.success()} />
          <Button label="Show entry code" variant="secondary" onPress={() => undefined} />
          <Button label="Get directions" variant="plain" onPress={() => undefined} />
          <Button
            label="Leave game"
            variant="destructive"
            onPress={() => toast.undo("You left Saturday's game.", () => toast.success("You're back in."))}
          />
          <Button
            label={loading ? "Saving" : "Tap to load"}
            loading={loading}
            onPress={() => {
              setLoading(true)
              setTimeout(() => setLoading(false), 1500)
            }}
          />
          <Button label="Not available" disabled onPress={() => undefined} />
        </View>
      </ListSection>

      <ListSection header="Sheets" footer="Drag, flick, catch mid-animation, and drag past the top to feel the edge.">
        <ListRow
          icon="calendar"
          title="Booking details"
          subtitle="Medium and large heights"
          onPress={() => setSheet("detents")}
        />
        <ListRow
          icon="book.fill"
          tone="neutral"
          title="Long content"
          subtitle="Scrolls inside, drags from the header"
          onPress={() => setSheet("scroll")}
        />
        <ListRow
          icon="info.circle.fill"
          tone="warning"
          title="Must choose"
          subtitle="Can't be swiped away"
          onPress={() => setSheet("locked")}
        />
      </ListSection>

      <ListSection header="Rows">
        <ListRow icon="person.fill" title="Personal details" subtitle="Amina Odhiambo, amina@example.com" onPress={() => undefined} />
        <ListRow icon="star.fill" tone="success" title="Level" accessory={{ kind: "value", value: "Intermediate" }} />
        <ListRow
          icon="paperplane.fill"
          title="Game reminders"
          subtitle="An hour before you play"
          accessory={{ kind: "toggle", value: reminders, onValueChange: setReminders }}
        />
        <ListRow icon="xmark.circle.fill" tone="destructive" title="Sign out" destructive onPress={() => undefined} />
      </ListSection>

      <Card onPress={() => undefined} accessibilityLabel="Type scale sample card">
        <View style={styles.stack}>
          {VARIANTS.map((variant) => (
            <AppText key={variant} variant={variant} numberOfLines={1}>
              {variant}
            </AppText>
          ))}
          <AppText variant="title1" tabular>
            12 · 48% · 1,024
          </AppText>
        </View>
      </Card>

      <Card>
        <EmptyState
          icon="calendar"
          title="No games booked yet"
          message="Book a table and your next game shows up here."
          action={{ label: "Book a table", onPress: () => undefined }}
        />
      </Card>

      <Sheet
        visible={sheet === "detents"}
        title="Saturday, 7:00 pm"
        detents={["medium", "large"]}
        onClose={() => setSheet(null)}
      >
        <View style={styles.stack}>
          <AppText variant="body" color="secondaryLabel">
            Table 2 · PlayTT Parklands · 4 players
          </AppText>
          <Button label="Show entry code" onPress={() => undefined} />
          <Button label="Change booking" variant="secondary" onPress={() => undefined} />
        </View>
      </Sheet>

      <Sheet visible={sheet === "scroll"} title="House rules" scrollable onClose={() => setSheet(null)}>
        <View style={styles.stack}>
          {Array.from({ length: 24 }, (_, i) => (
            <AppText key={i} variant="body">
              {i + 1}. Arrive five minutes early and leave the table ready for the next group.
            </AppText>
          ))}
        </View>
      </Sheet>

      <Sheet
        visible={sheet === "locked"}
        title="Keep your booking?"
        detents={["medium"]}
        dismissible={false}
        onClose={() => setSheet(null)}
      >
        <View style={styles.stack}>
          <AppText variant="body">Cancelling now refunds KSh 600 of KSh 1,200.</AppText>
          <Button label="Keep booking" onPress={() => setSheet(null)} />
          <Button label="Cancel booking" variant="destructive" onPress={() => setSheet(null)} />
        </View>
      </Sheet>
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: PlayTTSpacing.sm, marginTop: PlayTTSpacing.md },
  stack: { gap: PlayTTSpacing.sm, padding: PlayTTSpacing.md },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: PlayTTSpacing.md,
  },
})
