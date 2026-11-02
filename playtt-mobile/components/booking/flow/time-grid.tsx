import { StyleSheet, View } from "react-native"

import { EmptyState } from "@/components/kit/empty-state"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { SlotListSkeleton } from "@/components/ui/skeleton"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useSkeletonSurface } from "@/hooks/use-product-theme"
import type { SlotAvailability } from "@/lib/booking-types"
import { formatKes, isSlotStartInPast } from "@/lib/booking-utils"

type TimeGridProps = {
  slots: SlotAvailability[]
  selectedSlot: SlotAvailability | null
  nowMs: number
  isLoading: boolean
  onSelect: (slot: SlotAvailability) => void
  onTryTomorrow: () => void
}

function formatStart(iso: string) {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" })
}

function isOpen(slot: SlotAvailability) {
  return slot.isAvailable && slot.openTableCount > 0
}

/**
 * Big time buttons in two columns. Taken times stay visible but greyed and
 * labelled "Taken", so people see the day is busy rather than wondering.
 */
export function TimeGrid({ slots, selectedSlot, nowMs, isLoading, onSelect, onTryTomorrow }: TimeGridProps) {
  const { colors } = useAppTheme()
  const skeletonSurface = useSkeletonSurface()
  const upcoming = slots.filter((slot) => !isSlotStartInPast(slot.startsAt, nowMs))

  if (isLoading) return <SlotListSkeleton surface={skeletonSurface} />

  if (!upcoming.some(isOpen)) {
    return (
      <EmptyState
        icon="calendar"
        title="No free times this day"
        message="Every table is booked. Tomorrow might have space."
        action={{ label: "Try tomorrow", onPress: onTryTomorrow }}
      />
    )
  }

  return (
    <View style={styles.grid}>
      {upcoming.map((slot) => {
        const open = isOpen(slot)
        const selected = selectedSlot?.startsAt === slot.startsAt
        const price = formatKes(slot.price.totalAmount, slot.price.currency)
        const lastTable = open && slot.openTableCount === 1
        const detail = !open ? "Taken" : lastTable ? `${price} · last table` : price

        return (
          <PressableScale
            key={slot.startsAt}
            onPress={() => onSelect(slot)}
            disabled={!open}
            haptic="selection"
            accessibilityLabel={`${formatStart(slot.startsAt)}, ${detail}`}
            accessibilityState={{ selected, disabled: !open }}
            style={[
              styles.cell,
              {
                backgroundColor: selected ? colors.accent : colors.surface,
                borderColor: selected ? colors.accent : colors.separator,
              },
            ]}
          >
            <AppText variant="title3" tabular color={selected ? "onAccent" : open ? "label" : "tertiaryLabel"}>
              {formatStart(slot.startsAt)}
            </AppText>
            <AppText
              variant="footnote"
              weight={lastTable ? "600" : undefined}
              color={selected ? "onAccent" : !open ? "tertiaryLabel" : lastTable ? "warning" : "secondaryLabel"}
            >
              {detail}
            </AppText>
          </PressableScale>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: PlayTTSpacing.xs,
  },
  cell: {
    flexGrow: 1,
    flexBasis: "45%",
    minHeight: 72,
    paddingVertical: PlayTTSpacing.sm,
    paddingHorizontal: PlayTTSpacing.md,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    gap: 2,
  },
})
