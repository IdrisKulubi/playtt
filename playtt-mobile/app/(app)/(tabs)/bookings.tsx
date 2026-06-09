import { router, useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Button } from "@/components/ui/button"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { fetchMyBookings } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  formatBookingStatus,
  formatKes,
  formatTimeRange,
} from "@/lib/booking-utils"
import { toast } from "@/lib/toast"

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<UserBookingSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadBookings = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchMyBookings("all")
      setBookings(data)
    } catch (error) {
      toast.apiError(error, "Could not load your bookings.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadBookings()
    }, [loadBookings]),
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>My bookings</Text>

        {isLoading ? (
          <ActivityIndicator color={PlayTTColors.primary} />
        ) : bookings.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptyBody}>Book your first session to see it here.</Text>
            <Button
              label="Book a session"
              surface="product"
              onPress={() => router.push("/(app)/book")}
            />
          </View>
        ) : (
          bookings.map((booking) => (
            <Pressable
              key={booking.id}
              onPress={() =>
                router.push({
                  pathname: "/(app)/booking/[id]",
                  params: { id: booking.id },
                })
              }
              style={styles.card}
            >
              <Text style={styles.cardTitle}>{booking.locationName}</Text>
              <Text style={styles.cardTime}>
                {formatTimeRange(booking.startTime, booking.endTime)}
              </Text>
              <Text style={styles.cardStatus}>
                {formatBookingStatus(booking.status, booking.paymentStatus)}
              </Text>
              <Text style={styles.cardPrice}>
                {formatKes(booking.totalAmount, booking.currency)}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PlayTTColors.background,
  },
  scroll: {
    padding: PlayTTSpacing.xl,
    gap: PlayTTSpacing.md,
  },
  title: {
    ...PlayTTTypography.headline,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
  },
  empty: {
    gap: PlayTTSpacing.md,
    paddingVertical: PlayTTSpacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
  },
  card: {
    backgroundColor: PlayTTColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PlayTTColors.border,
    padding: PlayTTSpacing.md,
    gap: PlayTTSpacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
  },
  cardTime: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.medium,
    color: PlayTTColors.foreground,
  },
  cardStatus: {
    fontSize: 13,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
  },
  cardPrice: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.primary,
  },
})
