import { useMemo } from "react"
import { Pressable, Text, View } from "react-native"

import { createEditIntentSheetStyles } from "@/components/booking/booking-theme"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useProductTheme } from "@/hooks/use-product-theme"

export type EditIntent = "time" | "players"

type BookingEditIntentSheetProps = {
  visible: boolean
  changeTime: boolean
  addPlayers: boolean
  onClose: () => void
  onToggle: (intent: EditIntent) => void
  onContinue: () => void
}

const OPTIONS: { id: EditIntent; label: string; description: string }[] = [
  {
    id: "time",
    label: "Change time",
    description: "Pick a new slot at the same venue",
  },
  {
    id: "players",
    label: "Add players",
    description: "Bring more friends (no removals)",
  },
]

export function BookingEditIntentSheet({
  visible,
  changeTime,
  addPlayers,
  onClose,
  onToggle,
  onContinue,
}: BookingEditIntentSheetProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createEditIntentSheetStyles(theme), [theme])

  const selected = {
    time: changeTime,
    players: addPlayers,
  }

  return (
    <BottomSheet visible={visible} title="Edit booking" onClose={onClose}>
      <Text style={styles.intro}>What do you want to change?</Text>

      <View style={styles.list}>
        {OPTIONS.map((option) => {
          const active = selected[option.id]
          return (
            <Pressable
              key={option.id}
              onPress={() => onToggle(option.id)}
              style={[styles.row, active && styles.rowActive]}
            >
              <View>
                <Text style={styles.rowLabel}>{option.label}</Text>
                <Text style={styles.rowMeta}>{option.description}</Text>
              </View>
              {active ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          )
        })}
      </View>

      <Button
        label="Continue"
        surface="product"
        productTheme={theme}
        onPress={onContinue}
        disabled={!changeTime && !addPlayers}
      />
    </BottomSheet>
  )
}
