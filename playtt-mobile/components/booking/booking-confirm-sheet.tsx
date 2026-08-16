import { useMemo, useState } from "react"
import { Pressable, Text, TextInput, View } from "react-native"

import { createConfirmSheetStyles } from "@/components/booking/booking-theme"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useProductTheme, useSkeletonSurface } from "@/hooks/use-product-theme"
import type { BookingQuote, GroupSize, LocationSummary, SlotAvailability } from "@/lib/booking-types"
import {
  formatKes,
  formatPricingTierLabel,
  formatTimeRange,
} from "@/lib/booking-utils"

type BookingConfirmSheetProps = {
  visible: boolean
  location: LocationSummary | null
  selectedSlot: SlotAvailability | null
  groupSize: GroupSize
  quote: BookingQuote | null
  notes: string
  loading?: boolean
  onClose: () => void
  onNotesChange: (value: string) => void
  onConfirm: () => void
}

export function BookingConfirmSheet({
  visible,
  location,
  selectedSlot,
  groupSize,
  quote,
  notes,
  loading = false,
  onClose,
  onNotesChange,
  onConfirm,
}: BookingConfirmSheetProps) {
  const [notesOpen, setNotesOpen] = useState(false)
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createConfirmSheetStyles(theme), [theme])

  if (!location || !selectedSlot) return null

  const total = quote?.totalAmount ?? selectedSlot.price.totalAmount
  const currency = quote?.currency ?? selectedSlot.price.currency

  return (
    <BottomSheet visible={visible} title="Confirm your booking" onClose={onClose}>
      <View style={styles.summary}>
        <Text style={styles.venue}>{location.name}</Text>
        <Text style={styles.time}>
          {formatTimeRange(selectedSlot.startsAt, selectedSlot.endsAt)}
        </Text>
        <Text style={styles.meta}>{groupSize} players</Text>
        {quote ? (
          <Text style={styles.tier}>
            {formatPricingTierLabel(quote.pricingRuleSnapshot) ?? "Standard rate"}
          </Text>
        ) : (
          <Skeleton width={120} height={14} surface={skeletonSurface} />
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{formatKes(total, currency)}</Text>
        </View>
      </View>

      <Pressable onPress={() => setNotesOpen((open) => !open)}>
        <Text style={styles.notesToggle}>
          {notesOpen ? "Hide note" : "Add a note (optional)"}
        </Text>
      </Pressable>

      {notesOpen ? (
        <TextInput
          value={notes}
          onChangeText={onNotesChange}
          placeholder="Anything we should know?"
          placeholderTextColor={theme.muted}
          style={styles.notesInput}
          multiline
        />
      ) : null}

      <Text style={styles.subcopy}>
        Your table is held. We will confirm soon.
      </Text>

      <Button
        label="Book this slot"
        surface="product"
        productTheme={theme}
        onPress={onConfirm}
        loading={loading}
      />
    </BottomSheet>
  )
}
