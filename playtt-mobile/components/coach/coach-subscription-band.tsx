import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/ui/button"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { formatKes } from "@/lib/booking-utils"
import type { CoachStatus } from "@/lib/coach-types"

type CoachSubscriptionBandProps = {
  status: CoachStatus
  onSubscribe: () => void
}

export function CoachSubscriptionBand({
  status,
  onSubscribe,
}: CoachSubscriptionBandProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        band: {
          gap: PlayTTSpacing.sm,
          paddingVertical: PlayTTSpacing.md,
        },
        price: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.muted,
        },
      }),
    [theme],
  )

  if (status.isActive) {
    return null
  }

  return (
    <View style={styles.band}>
      <Text style={styles.price}>
        {formatKes(status.monthlyPriceKes)} per month
      </Text>
      <Button
        label="Start Coach"
        surface="product"
        productTheme={theme}
        onPress={onSubscribe}
      />
    </View>
  )
}
