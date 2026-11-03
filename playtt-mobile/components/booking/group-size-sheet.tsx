import { StyleSheet, View } from "react-native"

import { PlayerStepper } from "@/components/booking/flow/player-stepper"
import { Button } from "@/components/kit/button"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import type { GroupSize } from "@/lib/booking-types"
import { EXTRA_PLAYER_SURCHARGE, INCLUDED_PLAYERS, formatKes } from "@/lib/booking-utils"

type GroupSizeStepProps = {
  groupSize: GroupSize
  currency: string
  onGroupSizeChange: (size: GroupSize) => void
  onContinue: () => void
  loading?: boolean
  /** Optionally limit the smallest group size. */
  minGroupSize?: GroupSize
  continueLabel?: string
  hint?: string
}

/** Player count: the same big − / + as booking. */
export function GroupSizeStep({
  groupSize,
  currency,
  onGroupSizeChange,
  onContinue,
  loading = false,
  minGroupSize,
  continueLabel = "Continue",
  hint,
}: GroupSizeStepProps) {
  const defaultHint = `Up to ${INCLUDED_PLAYERS} players are included. Each extra player adds ${formatKes(EXTRA_PLAYER_SURCHARGE, currency)}.`

  return (
    <View style={styles.stack}>
      <PlayerStepper value={groupSize} onChange={onGroupSizeChange} min={minGroupSize} />
      <AppText variant="callout" color="secondaryLabel" style={styles.center}>
        {hint ?? defaultHint}
      </AppText>
      <Button label={continueLabel} onPress={onContinue} loading={loading} />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.md },
  center: { textAlign: "center" },
})
