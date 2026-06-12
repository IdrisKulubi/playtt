import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { PreviewBadge } from "@/components/ui/preview-badge"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductPaymentCheckout } from "@/hooks/use-product-payment-checkout"
import { useProductTheme } from "@/hooks/use-product-theme"
import { formatKes } from "@/lib/booking-utils"
import type { ReplayCreditsStatus } from "@/lib/coach-types"
import { USE_MOCK_PLAYER_DATA } from "@/lib/mock/mock-config"
import {
  fetchReplayCredits,
  initiateReplayPackPurchase,
} from "@/lib/replay-credits-api"
import { toast } from "@/lib/toast"

type ClipPackPurchaseSheetProps = {
  visible: boolean
  onClose: () => void
  onPurchased?: () => void
}

export function ClipPackPurchaseSheet({
  visible,
  onClose,
  onPurchased,
}: ClipPackPurchaseSheetProps) {
  const theme = useProductTheme()
  const [credits, setCredits] = useState<ReplayCreditsStatus | null>(null)

  const { displayText, isPaying, isWaiting, payLabel, handlePay } =
    useProductPaymentCheckout({
      initiate: initiateReplayPackPurchase,
      onConfirmed: async () => {
        const next = await fetchReplayCredits()
        setCredits(next)
        onPurchased?.()
        onClose()
        toast.success("Clip pack added to your balance.")
      },
    })

  useEffect(() => {
    if (!visible) {
      return
    }
    void fetchReplayCredits().then(setCredits)
  }, [visible])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.md,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        body: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 22,
        },
        balance: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
        },
        price: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        footnote: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
        },
      }),
    [theme],
  )

  const packCredits = credits?.packCredits ?? 10
  const packPrice = credits?.packPriceKes ?? 0

  const handlePress = () => {
    if (USE_MOCK_PLAYER_DATA) {
      toast.info("Clip pack checkout is preview only until payments go live.")
      return
    }
    void handlePay()
  }

  return (
    <BottomSheet visible={visible} title="10-clip pack" onClose={onClose}>
      <View style={styles.root}>
        <View style={styles.row}>
          <Text style={styles.price}>{formatKes(packPrice)}</Text>
          <PreviewBadge />
        </View>
        <Text style={styles.body}>
          Each clip saves the last 30 seconds from your session. One credit is
          used each time you press Replay at the venue.
        </Text>
        {credits ? (
          <Text style={styles.balance}>
            You have {credits.balance} clips left
          </Text>
        ) : null}
        {displayText && !USE_MOCK_PLAYER_DATA ? (
          <Text style={styles.footnote}>{displayText}</Text>
        ) : null}
        <Button
          label={
            USE_MOCK_PLAYER_DATA
              ? `Buy ${packCredits}-clip pack`
              : payLabel
          }
          surface="product"
          productTheme={theme}
          onPress={handlePress}
          loading={isPaying || isWaiting}
          disabled={USE_MOCK_PLAYER_DATA ? false : isWaiting}
        />
        {USE_MOCK_PLAYER_DATA ? (
          <Text style={styles.footnote}>
            Preview mode. Checkout opens when clip payments ship.
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  )
}
