import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { BookingDetailSkeleton } from "@/components/ui/skeleton"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { fetchBookingById } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  formatBookingStatus,
  formatKes,
  formatTimeRange,
} from "@/lib/booking-utils"
import { toast } from "@/lib/toast"

export default function BookingDetailScreen() {
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Booking</Text>
        <View style={styles.spacer} />
      </View>

      {isLoading ? (
        <BookingDetailSkeleton surface="dark" />
      ) : !booking ? (
        <View style={styles.loading}>
          <Text style={styles.missing}>Booking not found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>{booking.locationName}</Text>
          <Text style={styles.subtitle}>{booking.resourceName}</Text>
          <Text style={styles.time}>
            {formatTimeRange(booking.startTime, booking.endTime)}
          </Text>
          <Text style={styles.status}>
            {formatBookingStatus(booking.status, booking.paymentStatus)}
          </Text>
          <Text style={styles.price}>
            {formatKes(booking.totalAmount, booking.currency)}
          </Text>
          {booking.expiresAt ? (
            <Text style={styles.meta}>
              Hold expires:{" "}
              {new Date(booking.expiresAt).toLocaleString("en-KE")}
            </Text>
          ) : null}
          {booking.notes ? (
            <Text style={styles.meta}>Notes: {booking.notes}</Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PlayTTColors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PlayTTSpacing.lg,
    paddingTop: PlayTTSpacing.sm,
  },
  back: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.primary,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
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
    color: PlayTTColors.mutedText,
    fontFamily: PlayTTFontFamilies.regular,
  },
  scroll: {
    padding: PlayTTSpacing.xl,
    gap: PlayTTSpacing.sm,
  },
  title: {
    ...PlayTTTypography.headline,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: PlayTTFontFamilies.medium,
    color: PlayTTColors.mutedText,
  },
  time: {
    fontSize: 20,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
    marginTop: PlayTTSpacing.sm,
  },
  status: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
  },
  price: {
    fontSize: 18,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.primary,
    marginTop: PlayTTSpacing.sm,
  },
  meta: {
    fontSize: 13,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
  },
})
