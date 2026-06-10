import { router, useFocusEffect } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { BookingDetailSheet } from "@/components/booking/booking-detail-sheet"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { Button } from "@/components/ui/button"
import { BookingListSkeleton, SkeletonGate } from "@/components/ui/skeleton"
import { fetchMyBookings } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  formatBookingStatus,
  formatKes,
  formatTimeRange,
} from "@/lib/booking-utils"
import {
  useProductTheme,
  useSkeletonSurface,
} from "@/hooks/use-product-theme"
import { toast } from "@/lib/toast"

export default function BookingsScreen() {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])

  const [bookings, setBookings] = useState<UserBookingSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)

  const loadBookings = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchMyBookings("upcoming")
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
        <SkeletonGate
          loading={isLoading}
          skeleton={<BookingListSkeleton surface={skeletonSurface} />}
        >
          {bookings.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.title}>My bookings</Text>
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptyBody}>Book your first session to see it here.</Text>
              <Button
                label="Book a session"
                surface="product"
                onPress={() => router.push("/(app)/book")}
              />
            </View>
          ) : (
            <>
              <Text style={styles.title}>My bookings</Text>
              {bookings.map((booking) => (
                <Pressable
                  key={booking.id}
                  onPress={() => setSelectedBookingId(booking.id)}
                  style={styles.card}
                >
                  <Text style={styles.cardTitle}>{booking.locationName}</Text>
                  <Text style={styles.cardMuted}>
                    {formatTimeRange(booking.startTime, booking.endTime)}
                  </Text>
                  <Text style={styles.cardSubtle}>
                    {formatBookingStatus(booking.status, booking.paymentStatus)}
                  </Text>
                  <Text style={styles.cardPrice}>
                    {formatKes(booking.totalAmount, booking.currency)}
                  </Text>
                </Pressable>
              ))}
            </>
          )}
        </SkeletonGate>
      </ScrollView>

      <BookingDetailSheet
        visible={selectedBookingId !== null}
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
      />
    </SafeAreaView>
  )
}
