import { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { AppText } from "@/components/ui/app-text"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { PreviewBadge } from "@/components/ui/preview-badge"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductPaymentCheckout } from "@/hooks/use-product-payment-checkout"
import { formatKes } from "@/lib/booking-utils"
import { fetchCoachStatus, initiateCoachSubscribe } from "@/lib/coach-api"
import type { CoachStatus } from "@/lib/coach-types"
import { haptics } from "@/lib/haptics"
import { USE_MOCK_PLAYER_DATA } from "@/lib/mock/mock-config"
import { toast } from "@/lib/toast"

type CoachSubscribeSheetProps = {
  visible: boolean
  onClose: () => void
  onSubscribed?: () => void
}

/** Price first, then exactly what's included and what isn't, then one button. */
export function CoachSubscribeSheet({ visible, onClose, onSubscribed }: CoachSubscribeSheetProps) {
  const [status, setStatus] = useState<CoachStatus | null>(null)

  const { displayText, isPaying, isWaiting, payLabel, handlePay } = useProductPaymentCheckout({
    initiate: initiateCoachSubscribe,
    onConfirmed: async () => {
      const next = await fetchCoachStatus()
      setStatus(next)
      onSubscribed?.()
      onClose()
      haptics.success()
      toast.success("Coach is on for your account.")
    },
  })

  useEffect(() => {
    if (!visible) return
    void fetchCoachStatus().then(setStatus)
  }, [visible])

  const monthlyPrice = status?.monthlyPriceKes ?? 0

  const handlePress = () => {
    if (USE_MOCK_PLAYER_DATA) {
      toast.info("Coach is a preview for now. You can't pay for it yet.")
      return
    }
    if (status?.isActive) return
    void handlePay()
  }

  return (
    <BottomSheet visible={visible} title="Start Coach" onClose={onClose}>
      <View style={styles.root}>
        <View style={styles.priceRow}>
          <AppText variant="title2" tabular>
            {formatKes(monthlyPrice)}{" "}
            <AppText variant="callout" color="secondaryLabel">
              a month
            </AppText>
          </AppText>
          <PreviewBadge />
        </View>

        <ListSection>
          <ListRow
            icon="checkmark"
            tone="success"
            title="Included"
            subtitle="Notes on your replays after each game, and drills to practise."
          />
          <ListRow
            icon="film.stack"
            tone="neutral"
            title="Not included"
            subtitle="Replay packs, which save your highlights at the venue."
          />
        </ListSection>

        {displayText && !USE_MOCK_PLAYER_DATA ? (
          <AppText variant="callout" color="secondaryLabel">
            {displayText}
          </AppText>
        ) : null}

        <Button
          label={status?.isActive ? "Coach is on" : USE_MOCK_PLAYER_DATA ? "Start Coach" : payLabel}
          onPress={handlePress}
          loading={isPaying || isWaiting}
          disabled={status?.isActive === true}
        />

        {USE_MOCK_PLAYER_DATA ? (
          <AppText variant="footnote" color="secondaryLabel">
            Preview: paying for Coach opens when Coach payments go live.
          </AppText>
        ) : null}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  root: { gap: PlayTTSpacing.md },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
})
