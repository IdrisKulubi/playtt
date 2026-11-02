import { useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { BookingDetailContent } from "@/components/booking/booking-detail-content"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { ScreenBackButton } from "@/components/navigation/screen-back-button"
import { BookingDetailSkeleton } from "@/components/ui/skeleton"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { typeStyle } from "@/constants/type"
import { fetchBookingById } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useSkeletonSurface } from "@/hooks/use-product-theme"
import { toast } from "@/lib/toast"

export default function BookingDetailScreen() {
  const { colors } = useAppTheme()
  const skeletonSurface = useSkeletonSurface()
  const screenStyles = useMemo(() => createAppScreenStyles(colors), [colors])
  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: PlayTTSpacing.lg,
          paddingTop: PlayTTSpacing.sm,
        },
        headerTitle: {
          ...typeStyle("headline"),
          color: colors.label,
        },
        spacer: {
          width: 40,
        },
        loading: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        missing: {
          color: colors.secondaryLabel,
          ...typeStyle("body"),
        },
        scroll: {
          padding: PlayTTSpacing.xl,
        },
      }),
    [colors.label, colors.secondaryLabel],
  )

  const { id } = useLocalSearchParams<{ id?: string }>()
  const bookingId = typeof id === "string" ? id : ""
  const [booking, setBooking] = useState<UserBookingSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!bookingId) {
        setIsLoading(false)
        return
      }

      try {
        const data = await fetchBookingById(bookingId)
        if (mounted) setBooking(data)
      } catch (error) {
        toast.apiError(error, "Could not load booking details.")
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [bookingId])

  return (
    <SafeAreaView style={screenStyles.safeArea}>
      <View style={styles.header}>
        <ScreenBackButton />
        <Text style={styles.headerTitle}>Booking</Text>
        <View style={styles.spacer} />
      </View>

      {isLoading ? (
        <BookingDetailSkeleton surface={skeletonSurface} />
      ) : !booking ? (
        <View style={styles.loading}>
          <Text style={styles.missing}>Booking not found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <BookingDetailContent
            booking={booking}
            surface={skeletonSurface}
            onBookingUpdated={setBooking}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
