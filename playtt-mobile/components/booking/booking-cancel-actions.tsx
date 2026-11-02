import { useState } from "react"
import { Alert, StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { cancelBooking } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import { canCancelBooking } from "@/lib/booking-utils"
import { toast } from "@/lib/toast"

type BookingCancelActionsProps = {
  booking: UserBookingSummary
  onCancelled: () => void
}

/** Release an unpaid hold. It frees the table for others, so it asks first. */
export function BookingCancelActions({ booking, onCancelled }: BookingCancelActionsProps) {
  const [isCancelling, setIsCancelling] = useState(false)

  if (!canCancelBooking(booking)) return null

  function confirmCancel() {
    Alert.alert(
      "Let this table go?",
      "Your booking isn't paid yet. If you let it go, someone else can book this time.",
      [
        { text: "Keep my booking", style: "cancel" },
        { text: "Let it go", style: "destructive", onPress: () => void handleCancel() },
      ],
    )
  }

  async function handleCancel() {
    setIsCancelling(true)
    try {
      await cancelBooking(booking.id)
      toast.success("Booking cancelled. The table is free for others.")
      onCancelled()
    } catch (error) {
      toast.apiError(error, "Could not cancel this booking.")
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <View style={styles.root}>
      <AppText variant="callout" color="secondaryLabel">
        Don&apos;t need this table any more? You haven&apos;t paid, so cancelling costs nothing.
      </AppText>
      <Button label="Cancel booking" variant="destructive" onPress={confirmCancel} loading={isCancelling} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: PlayTTSpacing.sm },
})
