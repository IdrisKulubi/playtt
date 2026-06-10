import { router, useFocusEffect } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { Pressable, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { BrandMark } from "@/components/brand/brand-mark"
import { BookingDetailSheet } from "@/components/booking/booking-detail-sheet"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { Button } from "@/components/ui/button"
import { UpcomingCardSkeleton } from "@/components/ui/skeleton"
import { fetchMyBookings } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  formatBookingStatus,
  formatTimeRange,
} from "@/lib/booking-utils"
import {
  useProductTheme,
  useSkeletonSurface,
} from "@/hooks/use-product-theme"

const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function findUpcomingBooking(bookings: UserBookingSummary[]) {
  const now = Date.now()
  const cutoff = now + UPCOMING_WINDOW_MS

  return (
    bookings
      .filter((booking) => {
        if (booking.status === "cancelled" || booking.status === "expired") {
          return false
        }
        const start = new Date(booking.startTime).getTime()
        return start >= now && start <= cutoff
      })
      .sort(
        (left, right) =>
          new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
      )[0] ?? null
  )
}

export default function AppHomeScreen() {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])

  const [upcomingBooking, setUpcomingBooking] =
    useState<UserBookingSummary | null>(null)
  const [isLoadingUpcoming, setIsLoadingUpcoming] = useState(true)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)

  const loadUpcoming = useCallback(async () => {
    setIsLoadingUpcoming(true)
    try {
      const bookings = await fetchMyBookings("upcoming")
      setUpcomingBooking(findUpcomingBooking(bookings))
    } catch {
      setUpcomingBooking(null)
    } finally {
      setIsLoadingUpcoming(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadUpcoming()
    }, [loadUpcoming]),
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <BrandMark size="compact" />
        <Text style={styles.title}>Ready to play?</Text>

        <Button
          label="Book a session"
          surface="product"
          onPress={() => router.push("/(app)/book")}
        />

        {isLoadingUpcoming ? (
          <UpcomingCardSkeleton surface={skeletonSurface} />
        ) : upcomingBooking ? (
          <Pressable
            onPress={() => setSelectedBookingId(upcomingBooking.id)}
            style={styles.card}
          >
            <Text style={styles.cardAccent}>Upcoming booking</Text>
            <Text style={styles.cardTitle}>{upcomingBooking.locationName}</Text>
            <Text style={styles.cardMuted}>
              {formatTimeRange(
                upcomingBooking.startTime,
                upcomingBooking.endTime,
              )}
            </Text>
            <Text style={styles.cardSubtle}>
              {formatBookingStatus(
                upcomingBooking.status,
                upcomingBooking.paymentStatus,
              )}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <BookingDetailSheet
        visible={selectedBookingId !== null}
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
      />
    </SafeAreaView>
  )
}
