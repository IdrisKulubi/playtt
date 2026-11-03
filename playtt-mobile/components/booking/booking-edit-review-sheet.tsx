import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { AppText } from "@/components/ui/app-text"
import { Skeleton } from "@/components/ui/skeleton"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useSkeletonSurface } from "@/hooks/use-product-theme"
import type { ModificationPreview, UserBookingSummary } from "@/lib/booking-types"
import { formatKes, formatTimeRange } from "@/lib/booking-utils"

type BookingEditReviewStepProps = {
  booking: UserBookingSummary
  preview: ModificationPreview | null
  isQuoting: boolean
  isApplying: boolean
  isConfirming: boolean
  confirmLabel: string
  onConfirm: () => void
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })
}

/** Before and after, side by side as two short lists, then what it costs. */
export function BookingEditReviewStep({
  booking,
  preview,
  isQuoting,
  isApplying,
  isConfirming,
  confirmLabel,
  onConfirm,
}: BookingEditReviewStepProps) {
  const skeletonSurface = useSkeletonSurface()
  const delta = preview ? Number(preview.deltaAmount) : 0
  const credit = preview ? Number(preview.creditAmount) : 0

  const ctaLabel =
    isConfirming || isApplying
      ? confirmLabel
      : preview && delta > 0
        ? `Pay ${formatKes(preview.deltaAmount, preview.currency)} and confirm`
        : "Confirm changes"

  return (
    <View style={styles.stack}>
      <AppText variant="callout" color="secondaryLabel">
        {booking.locationName} · same venue
      </AppText>

      <ListSection header="Now" separatorInset={16}>
        <ListRow
          title={`${formatDay(booking.startTime)}, ${formatTimeRange(booking.startTime, booking.endTime)}`}
          subtitle={`${booking.groupSize} players`}
          accessory={{ kind: "value", value: formatKes(booking.totalAmount, booking.currency) }}
        />
      </ListSection>

      {isQuoting || !preview ? (
        <View style={styles.quoting} accessibilityLiveRegion="polite">
          <Skeleton width="100%" height={56} borderRadius={12} surface={skeletonSurface} />
          <AppText variant="callout" color="secondaryLabel">
            Working out the new price…
          </AppText>
        </View>
      ) : (
        <ListSection header="After the change" separatorInset={16}>
          <ListRow
            title={`${formatDay(preview.newStartTime)}, ${formatTimeRange(preview.newStartTime, preview.newEndTime)}`}
            subtitle={`${preview.newGroupSize} players`}
            accessory={{ kind: "value", value: formatKes(preview.newTotal, preview.currency) }}
          />
        </ListSection>
      )}

      {preview && !isQuoting ? (
        delta > 0 ? (
          <View style={styles.due}>
            <AppText variant="headline">To pay now</AppText>
            <AppText variant="title2" tabular>
              {formatKes(preview.deltaAmount, preview.currency)}
            </AppText>
          </View>
        ) : (
          <AppText variant="callout" color="secondaryLabel">
            {credit > 0
              ? `Nothing to pay. ${formatKes(preview.creditAmount, preview.currency)} stays on your PlayTT account as credit.`
              : "Nothing extra to pay."}
          </AppText>
        )
      ) : null}

      <Button
        label={ctaLabel}
        onPress={onConfirm}
        loading={isApplying || isConfirming}
        disabled={!preview || isQuoting}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.md },
  quoting: { gap: PlayTTSpacing.xs },
  due: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
})
