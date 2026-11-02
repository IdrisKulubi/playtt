import { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { AppText } from "@/components/ui/app-text"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { PreviewBadge } from "@/components/ui/preview-badge"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductPaymentCheckout } from "@/hooks/use-product-payment-checkout"
import { formatKes } from "@/lib/booking-utils"
import type { ReplayCreditsStatus } from "@/lib/coach-types"
import { haptics } from "@/lib/haptics"
import { USE_MOCK_PLAYER_DATA } from "@/lib/mock/mock-config"
import { fetchReplayCredits, initiateReplayPackPurchase } from "@/lib/replay-credits-api"
import { toast } from "@/lib/toast"

type ClipPackPurchaseSheetProps = {
  visible: boolean
  onClose: () => void
  onPurchased?: () => void
}

function replaysLeft(balance: number) {
  if (balance === 0) return "You have no replays left"
  return balance === 1 ? "You have 1 replay left" : `You have ${balance} replays left`
}

/** Buy a replay pack: price, what one replay is, what you have now, one button. */
export function ClipPackPurchaseSheet({ visible, onClose, onPurchased }: ClipPackPurchaseSheetProps) {
  const [credits, setCredits] = useState<ReplayCreditsStatus | null>(null)

  const { displayText, isPaying, isWaiting, payLabel, handlePay } = useProductPaymentCheckout({
    initiate: initiateReplayPackPurchase,
    onConfirmed: async () => {
      const next = await fetchReplayCredits()
      setCredits(next)
      onPurchased?.()
      onClose()
      haptics.success()
      toast.success("Replays added to your account.")
    },
  })

  useEffect(() => {
    if (!visible) return
    void fetchReplayCredits().then(setCredits)
  }, [visible])

  const packCredits = credits?.packCredits ?? 10
  const packPrice = credits?.packPriceKes ?? 0

  const handlePress = () => {
    if (USE_MOCK_PLAYER_DATA) {
      toast.info("Replay packs are a preview for now. You can't pay for them yet.")
      return
    }
    void handlePay()
  }

  return (
    <BottomSheet visible={visible} title={`${packCredits} replays`} onClose={onClose}>
      <View style={styles.root}>
        <View style={styles.priceRow}>
          <AppText variant="title2" tabular>
            {formatKes(packPrice)}
          </AppText>
          <PreviewBadge />
        </View>
        <AppText variant="body" color="secondaryLabel">
          Each replay saves the last 30 seconds of your game. One is used each time you press Replay at the venue.
        </AppText>
        {credits ? <AppText variant="headline">{replaysLeft(credits.balance)}</AppText> : null}
        {displayText && !USE_MOCK_PLAYER_DATA ? (
          <AppText variant="callout" color="secondaryLabel">
            {displayText}
          </AppText>
        ) : null}
        <Button
          label={USE_MOCK_PLAYER_DATA ? `Buy ${packCredits} replays` : payLabel}
          onPress={handlePress}
          loading={isPaying || isWaiting}
          disabled={USE_MOCK_PLAYER_DATA ? false : isWaiting}
        />
        {USE_MOCK_PLAYER_DATA ? (
          <AppText variant="footnote" color="secondaryLabel">
            Preview: buying replays opens when replay payments go live.
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
