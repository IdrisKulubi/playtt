import { useMemo } from "react"
import { Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { createCheckoutBarStyles } from "@/components/booking/booking-theme"
import { Button } from "@/components/ui/button"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { BookingQuote, SlotAvailability } from "@/lib/booking-types"
import { formatSlotSummary } from "@/lib/booking-utils"

type BookingCheckoutBarProps = {
  visible: boolean
  selectedSlot: SlotAvailability
  durationMinutes: number
  quote: BookingQuote | null
  onPrimaryAction: () => void
  disabled?: boolean
}

export function BookingCheckoutBar({
  visible,
  selectedSlot,
  durationMinutes,
  quote,
  onPrimaryAction,
  disabled = false,
}: BookingCheckoutBarProps) {
  const insets = useSafeAreaInsets()
  const theme = useProductTheme()
  const styles = useMemo(() => createCheckoutBarStyles(theme), [theme])

  if (!visible) return null

  const amount = quote?.totalAmount ?? selectedSlot.price.totalAmount
  const currency = quote?.currency ?? selectedSlot.price.currency

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, PlayTTSpacing.sm) }]}>
      <View style={styles.content}>
        <View style={styles.summary}>
          <Text style={styles.summaryText} numberOfLines={2}>
            {formatSlotSummary(
              selectedSlot.startsAt,
              durationMinutes,
              amount,
              currency,
            )}
          </Text>
        </View>
        <Button
          label="Book this slot"
          surface="product"
          productTheme={theme}
          compact
          fullWidth={false}
          onPress={onPrimaryAction}
          disabled={disabled}
          style={styles.button}
        />
      </View>
    </View>
  )
}
