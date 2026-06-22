import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { createCheckoutBarStyles } from "@/components/booking/booking-theme"
import { Button } from "@/components/ui/button"
import { LiquidGlassShell } from "@/components/ui/liquid-glass-shell"
import { resolveColorScheme } from "@/constants/theme"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"
import { useProductTheme } from "@/hooks/use-product-theme"
import { canUseLiquidGlass } from "@/lib/liquid-glass"
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
  const colorScheme = resolveColorScheme(useColorScheme())
  const useNativeGlass = canUseLiquidGlass()
  const styles = useMemo(() => createCheckoutBarStyles(theme), [theme])

  if (!visible) return null

  const amount = quote?.totalAmount ?? selectedSlot.price.totalAmount
  const currency = quote?.currency ?? selectedSlot.price.currency

  return (
    <View
      style={[
        styles.bar,
        !useNativeGlass && styles.barFallback,
        { paddingBottom: Math.max(insets.bottom, PlayTTSpacing.sm) },
      ]}
    >
      <LiquidGlassShell
        colorScheme={colorScheme}
        style={StyleSheet.absoluteFill}
        shape="rectangle"
        borderRadius={0}
        variant="regular"
        blurIntensity={72}
        showBorder={!useNativeGlass}
        borderColor={theme.border}
      />

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
