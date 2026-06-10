import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text } from "react-native"

import { BookingDetailContent } from "@/components/booking/booking-detail-content"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { BookingDetailSkeleton } from "@/components/ui/skeleton"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { fetchBookingById } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  useProductTheme,
  useSkeletonSurface,
} from "@/hooks/use-product-theme"
import { toast } from "@/lib/toast"

type BookingDetailSheetProps = {
  visible: boolean
  bookingId: string | null
  onClose: () => void
}

export function BookingDetailSheet({
  visible,
  bookingId,
  onClose,
}: BookingDetailSheetProps) {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        error: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          paddingBottom: PlayTTSpacing.md,
        },
      }),
    [theme.muted],
  )

  const [booking, setBooking] = useState<UserBookingSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!visible || !bookingId) {
      setBooking(null)
      setLoadError(false)
      setIsLoading(false)
      return
    }

    let mounted = true
    const resolvedBookingId = bookingId

    async function load() {
      setIsLoading(true)
      setLoadError(false)
      setBooking(null)

      try {
        const data = await fetchBookingById(resolvedBookingId)
        if (mounted) {
          setBooking(data)
        }
      } catch (error) {
        if (mounted) {
          setLoadError(true)
          toast.apiError(error, "Could not load booking details.")
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [visible, bookingId])

  const title = booking?.locationName ?? "Booking"
  const sheetSurface = skeletonSurface === "dark" ? "dark" : "product"

  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={onClose}
      surface={sheetSurface}
      scrollable
    >
      {isLoading ? (
        <BookingDetailSkeleton surface={skeletonSurface} />
      ) : loadError ? (
        <Text style={styles.error}>Could not load this booking.</Text>
      ) : booking ? (
        <BookingDetailContent
          booking={booking}
          surface={skeletonSurface}
          onBookingUpdated={setBooking}
        />
      ) : (
        <Text style={styles.error}>Booking not found.</Text>
      )}
    </BottomSheet>
  )
}
