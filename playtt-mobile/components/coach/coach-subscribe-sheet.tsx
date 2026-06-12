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
import { fetchCoachStatus, initiateCoachSubscribe } from "@/lib/coach-api"
import { formatKes } from "@/lib/booking-utils"
import type { CoachStatus } from "@/lib/coach-types"
import { USE_MOCK_PLAYER_DATA } from "@/lib/mock/mock-config"
import { toast } from "@/lib/toast"

type CoachSubscribeSheetProps = {
  visible: boolean
  onClose: () => void
  onSubscribed?: () => void
}

export function CoachSubscribeSheet({
  visible,
  onClose,
  onSubscribed,
}: CoachSubscribeSheetProps) {
  const theme = useProductTheme()
  const [status, setStatus] = useState<CoachStatus | null>(null)

  const { displayText, isPaying, isWaiting, payLabel, handlePay } =
    useProductPaymentCheckout({
      initiate: initiateCoachSubscribe,
      onConfirmed: async () => {
        const next = await fetchCoachStatus()
        setStatus(next)
        onSubscribed?.()
        onClose()
        toast.success("Coach is active on your account.")
      },
    })

  useEffect(() => {
    if (!visible) {
      return
    }
    void fetchCoachStatus().then(setStatus)
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
        price: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        hairline: {
          paddingVertical: PlayTTSpacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        hairlineLast: {
          borderBottomWidth: 0,
        },
        hairlineTitle: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
        },
        hairlineBody: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
          marginTop: 2,
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

  const monthlyPrice = status?.monthlyPriceKes ?? 0

  const handlePress = () => {
    if (USE_MOCK_PLAYER_DATA) {
      toast.info("Coach subscription is preview only until payments go live.")
      return
    }
    if (status?.isActive) {
      return
    }
    void handlePay()
  }

  return (
    <BottomSheet visible={visible} title="Start Coach" onClose={onClose}>
      <View style={styles.root}>
        <View style={styles.row}>
          <Text style={styles.price}>
            {formatKes(monthlyPrice)} per month
          </Text>
          <PreviewBadge />
        </View>

        <View style={styles.hairline}>
          <Text style={styles.hairlineTitle}>What you get</Text>
          <Text style={styles.hairlineBody}>
            Insights from your captured clips after each session.
          </Text>
        </View>
        <View style={[styles.hairline, styles.hairlineLast]}>
          <Text style={styles.hairlineTitle}>What you still buy separately</Text>
          <Text style={styles.hairlineBody}>
            Clip packs to capture highlights at the venue.
          </Text>
        </View>

        {displayText && !USE_MOCK_PLAYER_DATA ? (
          <Text style={styles.footnote}>{displayText}</Text>
        ) : null}

        <Button
          label={
            status?.isActive
              ? "Coach is active"
              : USE_MOCK_PLAYER_DATA
                ? "Start Coach"
                : payLabel
          }
          surface="product"
          productTheme={theme}
          onPress={handlePress}
          loading={isPaying || isWaiting}
          disabled={status?.isActive === true}
        />

        {USE_MOCK_PLAYER_DATA ? (
          <Text style={styles.footnote}>
            Preview mode. Checkout opens when Coach payments ship.
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  )
}
