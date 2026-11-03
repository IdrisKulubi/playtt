import { StyleSheet, View } from "react-native"

import { DateStrip } from "@/components/booking/flow/date-strip"
import { TimeGrid } from "@/components/booking/flow/time-grid"
import { Button } from "@/components/kit/button"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import type { LocationSummary, SlotAvailability } from "@/lib/booking-types"
import { addDaysToDateKey } from "@/lib/booking-utils"

type BookingEditTimeStepProps = {
  location: LocationSummary | null
  dateStrip: Date[]
  selectedDate: string
  /** A time change keeps the booking's length. */
  durationMinutes: 30 | 60
  slots: SlotAvailability[]
  selectedSlot: SlotAvailability | null
  isLoadingSlots: boolean
  nowMs: number
  onDateChange: (dateKey: string) => void
  onSlotSelect: (slot: SlotAvailability) => void
  onContinue: () => void
}

/** Change time: the same day strip and time buttons as booking. */
export function BookingEditTimeStep({
  location,
  dateStrip,
  selectedDate,
  durationMinutes,
  slots,
  selectedSlot,
  isLoadingSlots,
  nowMs,
  onDateChange,
  onSlotSelect,
  onContinue,
}: BookingEditTimeStepProps) {
  const canContinue = Boolean(selectedSlot && selectedSlot.startsAt.slice(0, 10) === selectedDate)

  return (
    <View style={styles.stack}>
      <AppText variant="callout" color="secondaryLabel">
        {location ? `${location.name} · ` : ""}
        {durationMinutes === 60 ? "1 hour" : "30 min"}, same as now
      </AppText>
      <DateStrip days={dateStrip} selectedDate={selectedDate} onChange={onDateChange} />
      <TimeGrid
        slots={slots}
        selectedSlot={selectedSlot}
        nowMs={nowMs}
        isLoading={isLoadingSlots}
        onSelect={onSlotSelect}
        onTryTomorrow={() => onDateChange(addDaysToDateKey(selectedDate, 1))}
      />
      <Button
        label="Continue"
        onPress={onContinue}
        disabled={!canContinue}
        accessibilityHint={canContinue ? undefined : "Pick a new time first"}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.lg },
})
