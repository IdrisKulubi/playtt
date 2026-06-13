import { router, useFocusEffect } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { BookingDetailSheet } from "@/components/booking/booking-detail-sheet"
import { BookingSessionCard } from "@/components/booking/booking-session-card"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { Button } from "@/components/ui/button"
import { SegmentControl } from "@/components/ui/segment-control"
import { BookingListSkeleton, SkeletonGate } from "@/components/ui/skeleton"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { fetchMyBookings } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  useProductTheme,
  useSkeletonSurface,
} from "@/hooks/use-product-theme"
import { toast } from "@/lib/toast"

type BookingFilter = "upcoming" | "past"

export default function BookingsScreen() {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])

  const [filter, setFilter] = useState<BookingFilter>("upcoming")
  const [bookings, setBookings] = useState<UserBookingSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)

  const loadBookings = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchMyBookings(filter)
      setBookings(data)
    } catch (error) {
      toast.apiError(error, "Could not load your bookings.")
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  useFocusEffect(
    useCallback(() => {
      void loadBookings()
    }, [loadBookings]),
  )

  const emptyTitle =
    filter === "upcoming" ? "No upcoming bookings" : "No past sessions yet"
  const emptyBody =
    filter === "upcoming"
      ? "Book your first session to see it here."
      : "Completed sessions will appear here after you play."

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>My bookings</Text>

        <SegmentControl
          value={filter}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "past", label: "Past" },
          ]}
          onChange={setFilter}
        />

        <SkeletonGate
          loading={isLoading}
          skeleton={<BookingListSkeleton surface={skeletonSurface} />}
        >
          {bookings.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptyBody}>{emptyBody}</Text>
              {filter === "upcoming" ? (
                <Button
                  label="Book a session"
                  surface="product"
                  onPress={() => router.push("/(app)/book")}
                />
              ) : null}
            </View>
          ) : (
            <View style={{ gap: PlayTTSpacing.md }}>
              {bookings.map((booking) => (
                <BookingSessionCard
                  key={booking.id}
                  booking={booking}
                  showPrice
                  onPress={() => setSelectedBookingId(booking.id)}
                />
              ))}
            </View>
          )}
        </SkeletonGate>
      </ScrollView>

      <BookingDetailSheet
        visible={selectedBookingId !== null}
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onBookingChanged={() => void loadBookings()}
      />
    </SafeAreaView>
  )
}
