import { StyleSheet, View } from "react-native"

import { PlayerStepper } from "@/components/booking/flow/player-stepper"
import { Button } from "@/components/kit/button"
import { AppText } from "@/components/ui/app-text"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import type { GroupSize } from "@/lib/booking-types"
import { EXTRA_PLAYER_SURCHARGE, INCLUDED_PLAYERS, formatKes } from "@/lib/booking-utils"

type GroupSizeSheetProps = {
  visible: boolean
  groupSize: GroupSize
  currency: string
  onClose: () => void
  onGroupSizeChange: (size: GroupSize) => void
  onContinue: () => void
  loading?: boolean
  /** Edit mode: optionally limit the smallest group size. */
  minGroupSize?: GroupSize
  title?: string
  continueLabel?: string
  hint?: string
}

/** Player count in a sheet: the same big − / + as booking. */
export function GroupSizeSheet({
  visible,
  groupSize,
  currency,
  onClose,
  onGroupSizeChange,
  onContinue,
  loading = false,
  minGroupSize,
  title = "How many players?",
  continueLabel = "Continue",
  hint,
}: GroupSizeSheetProps) {
  const defaultHint = `Up to ${INCLUDED_PLAYERS} players are included. Each extra player adds ${formatKes(EXTRA_PLAYER_SURCHARGE, currency)}.`

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <View style={styles.stack}>
        <PlayerStepper value={groupSize} onChange={onGroupSizeChange} min={minGroupSize} />
        <AppText variant="callout" color="secondaryLabel" style={styles.center}>
          {hint ?? defaultHint}
        </AppText>
        <Button label={continueLabel} onPress={onContinue} loading={loading} />
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.md },
  center: { textAlign: "center" },
})
