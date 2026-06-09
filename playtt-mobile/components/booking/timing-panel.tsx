import { useMemo } from "react"
import { Pressable, ScrollView, Text, View } from "react-native"

import { createTimingPanelStyles } from "@/components/booking/booking-theme"
import { Button } from "@/components/ui/button"
import { SlotListSkeleton } from "@/components/ui/skeleton"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme, useSkeletonSurface } from "@/hooks/use-product-theme"
import type { LocationSummary, SlotAvailability } from "@/lib/booking-types"
import {
  addDaysToDateKey,
  formatDateChipLabel,
  formatKes,
  formatTimeRange,
  isSlotStartInPast,
  slotSubtitle,
  toDateKey,
} from "@/lib/booking-utils"

type TimingPanelProps = {
  location: LocationSummary | null
  dateStrip: Date[]
  selectedDate: string
  durationMinutes: 30 | 60
  slots: SlotAvailability[]
  selectedSlot: SlotAvailability | null
  isLoadingSlots: boolean
  nowMs: number
  listBottomInset?: number
  onDateChange: (dateKey: string) => void
  onDurationChange: (minutes: 30 | 60) => void
  onSlotSelect: (slot: SlotAvailability) => void
}

export function TimingPanel({
  location,
  dateStrip,
  selectedDate,
  durationMinutes,
  slots,
  selectedSlot,
  isLoadingSlots,
  nowMs,
  listBottomInset = 0,
  onDateChange,
  onDurationChange,
  onSlotSelect,
}: TimingPanelProps) {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createTimingPanelStyles(theme), [theme])
  const availableSlots = slots.filter(
    (slot) => !isSlotStartInPast(slot.startsAt, nowMs) && slot.isAvailable,
  )

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {location ? (
          <View style={styles.venueChip}>
            <Text style={styles.venueChipLabel}>{location.name}</Text>
          </View>
        ) : null}

        <Text style={styles.heading}>When do you want to play?</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.dateRow}>
            {dateStrip.map((day) => {
              const key = toDateKey(day)
              const selected = key === selectedDate
              return (
                <Pressable
                  key={key}
                  onPress={() => onDateChange(key)}
                  style={[styles.dateChip, selected && styles.dateChipSelected]}
                >
                  <Text
                    style={[
                      styles.dateChipDay,
                      selected && styles.dateChipTextSelected,
                    ]}
                  >
                    {formatDateChipLabel(day)}
                  </Text>
                  <Text
                    style={[
                      styles.dateChipDate,
                      selected && styles.dateChipTextSelected,
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>

        <View style={styles.toggleRow}>
          {[30, 60].map((value) => {
            const selected = durationMinutes === value
            return (
              <Pressable
                key={value}
                onPress={() => onDurationChange(value as 30 | 60)}
                style={[styles.toggle, selected && styles.toggleSelected]}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    selected && styles.toggleLabelSelected,
                  ]}
                >
                  {value} min
                </Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={styles.slotsLabel}>Available times</Text>
      </View>

      <ScrollView
        style={styles.slotList}
        contentContainerStyle={[
          styles.slotListContent,
          (isLoadingSlots || availableSlots.length === 0) && styles.slotListEmpty,
          { paddingBottom: listBottomInset + PlayTTSpacing.md },
        ]}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {isLoadingSlots ? (
          <SlotListSkeleton surface={skeletonSurface} />
        ) : availableSlots.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No times left for this day.</Text>
            <Button
              label="Try tomorrow"
              variant="outline"
              surface="product"
              productTheme={theme}
              onPress={() => onDateChange(addDaysToDateKey(selectedDate, 1))}
            />
          </View>
        ) : (
          availableSlots.map((slot) => {
            const selected = selectedSlot?.startsAt === slot.startsAt
            return (
              <Pressable
                key={slot.startsAt}
                onPress={() => onSlotSelect(slot)}
                style={[
                  styles.slotRow,
                  selected && styles.slotRowSelected,
                ]}
              >
                <View>
                  <Text style={styles.slotTime}>
                    {formatTimeRange(slot.startsAt, slot.endsAt)}
                  </Text>
                  <Text style={styles.slotMeta}>{slotSubtitle(slot, nowMs)}</Text>
                </View>
                <Text style={styles.slotPrice}>
                  {formatKes(slot.price.totalAmount, slot.price.currency)}
                </Text>
              </Pressable>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
