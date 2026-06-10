import { useMemo } from "react"
import { Text, View } from "react-native"

import { createEditReviewSheetStyles } from "@/components/booking/booking-theme"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useProductTheme, useSkeletonSurface } from "@/hooks/use-product-theme"
import type { ModificationPreview, UserBookingSummary } from "@/lib/booking-types"
import { formatKes, formatTimeRange } from "@/lib/booking-utils"

type BookingEditReviewSheetProps = {
  visible: boolean
  booking: UserBookingSummary
  preview: ModificationPreview | null
  isQuoting: boolean
  isApplying: boolean
  isConfirming: boolean
  confirmLabel: string
  onClose: () => void
  onConfirm: () => void
}

function formatSummaryLine(
  startTime: string,
  endTime: string,
  groupSize: number,
  total: string,
  currency: string,
) {
  return `${formatTimeRange(startTime, endTime)} · ${groupSize} players · ${formatKes(total, currency)}`
}

export function BookingEditReviewSheet({
  visible,
  booking,
  preview,
  isQuoting,
  isApplying,
  isConfirming,
  confirmLabel,
  onClose,
  onConfirm,
}: BookingEditReviewSheetProps) {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createEditReviewSheetStyles(theme), [theme])

  const currentLine = formatSummaryLine(
    booking.startTime,
    booking.endTime,
    booking.groupSize,
    booking.totalAmount,
    booking.currency,
  )

  const delta = preview ? Number(preview.deltaAmount) : 0
  const savings =
    preview && Number(preview.newTotal) < Number(preview.currentTotal)
      ? Number(preview.currentTotal) - Number(preview.newTotal)
      : 0

  const ctaLabel =
    isConfirming || isApplying
      ? confirmLabel
      : preview && delta > 0
        ? `Pay ${formatKes(preview.deltaAmount, preview.currency)} and confirm`
        : "Confirm changes"

  return (
    <BottomSheet visible={visible} title="Review changes" onClose={onClose}>
      <Text style={styles.anchor}>
        {booking.locationName} · Same venue
      </Text>

      <View style={styles.diffBlock}>
        <View style={styles.diffRow}>
          <Text style={styles.diffLabel}>Current</Text>
          <Text style={[styles.diffValue, styles.diffValueMuted]}>
            {currentLine}
          </Text>
        </View>

        <View style={styles.diffRow}>
          <Text style={styles.diffLabel}>Updated</Text>
          {isQuoting || !preview ? (
            <View style={styles.quotingRow}>
              <Skeleton width="100%" height={20} surface={skeletonSurface} />
            </View>
          ) : (
            <Text style={styles.diffValue}>
              {formatSummaryLine(
                preview.newStartTime,
                preview.newEndTime,
                preview.newGroupSize,
                preview.newTotal,
                preview.currency,
              )}
            </Text>
          )}
        </View>
      </View>

      {preview && savings > 0 ? (
        <Text style={styles.savingsNote}>
          New total {formatKes(preview.newTotal, preview.currency)} (
          {formatKes(String(savings), preview.currency)} less, no refund).
        </Text>
      ) : null}

      {preview && !isQuoting ? (
        delta > 0 ? (
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Due today</Text>
            <Text style={styles.paymentAmount}>
              {formatKes(preview.deltaAmount, preview.currency)}
            </Text>
          </View>
        ) : (
          <Text style={styles.savingsNote}>No extra payment needed.</Text>
        )
      ) : isQuoting ? (
        <Text style={styles.savingsNote}>Calculating new total…</Text>
      ) : null}

      <Button
        label={ctaLabel}
        surface="product"
        productTheme={theme}
        onPress={onConfirm}
        loading={isApplying || isConfirming}
        disabled={!preview || isQuoting}
      />
    </BottomSheet>
  )
}
