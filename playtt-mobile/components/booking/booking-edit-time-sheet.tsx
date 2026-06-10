import { useMemo } from "react"
import { View } from "react-native"

import { TimingPanel } from "@/components/booking/timing-panel"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { LocationSummary, SlotAvailability } from "@/lib/booking-types"

type BookingEditTimeSheetProps = {
  visible: boolean
  location: LocationSummary | null
  dateStrip: Date[]
  selectedDate: string
  durationMinutes: 30 | 60
  slots: SlotAvailability[]
  selectedSlot: SlotAvailability | null
  isLoadingSlots: boolean
  nowMs: number
  onClose: () => void
  onDateChange: (dateKey: string) => void
  onSlotSelect: (slot: SlotAvailability) => void
  onContinue: () => void
}

export function BookingEditTimeSheet({
  visible,
  location,
  dateStrip,
  selectedDate,
  durationMinutes,
  slots,
  selectedSlot,
  isLoadingSlots,
  nowMs,
  onClose,
  onDateChange,
  onSlotSelect,
  onContinue,
}: BookingEditTimeSheetProps) {
  const theme = useProductTheme()
  const canContinue = useMemo(() => {
    if (!selectedSlot) {
      return false
    }

    const slotDate = selectedSlot.startsAt.slice(0, 10)
    return slotDate === selectedDate
  }, [selectedDate, selectedSlot])

  return (
    <BottomSheet visible={visible} title="Change time" onClose={onClose} scrollable>
      <TimingPanel
        location={location}
        dateStrip={dateStrip}
        selectedDate={selectedDate}
        durationMinutes={durationMinutes}
        slots={slots}
        selectedSlot={selectedSlot}
        isLoadingSlots={isLoadingSlots}
        nowMs={nowMs}
        compact
        hideDurationToggle
        heading="Pick a new time"
        onDateChange={onDateChange}
        onDurationChange={() => {}}
        onSlotSelect={onSlotSelect}
      />

      <View>
        <Button
          label="Continue"
          surface="product"
          productTheme={theme}
          onPress={onContinue}
          disabled={!canContinue}
        />
      </View>
    </BottomSheet>
  )
}
