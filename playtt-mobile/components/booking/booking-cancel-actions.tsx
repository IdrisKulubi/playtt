import { useMemo, useState } from "react"
import { Alert, StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/ui/button"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { cancelBooking } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import { canCancelBooking } from "@/lib/booking-utils"
import { toast } from "@/lib/toast"

type BookingCancelActionsProps = {
  booking: UserBookingSummary
  onCancelled: () => void
}

export function BookingCancelActions({
  booking,
  onCancelled,
}: BookingCancelActionsProps) {
  const theme = useProductTheme()
  const [isCancelling, setIsCancelling] = useState(false)
  const styles = useMemo(
    () =>
      StyleSheet.create({
        copy: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
        },
      }),
    [theme.muted],
  )

  if (!canCancelBooking(booking)) {
    return null
  }

  function confirmCancel() {
    Alert.alert(
      "Release this hold?",
      "This unpaid booking will be cancelled and the slot will open for others.",
      [
        { text: "Keep hold", style: "cancel" },
        {
          text: "Release hold",
          style: "destructive",
          onPress: () => void handleCancel(),
        },
      ],
    )
  }

  async function handleCancel() {
    setIsCancelling(true)

    try {
      await cancelBooking(booking.id)
      toast.success("Booking released.")
      onCancelled()
    } catch (error) {
      toast.apiError(error, "Could not release this booking.")
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <View style={{ gap: PlayTTSpacing.sm }}>
      <Text style={styles.copy}>
        This slot is held but not paid. Release it if you no longer need it.
      </Text>
      <Button
        label="Release hold"
        variant="outline"
        surface="product"
        productTheme={theme}
        onPress={confirmCancel}
        loading={isCancelling}
      />
    </View>
  )
}
