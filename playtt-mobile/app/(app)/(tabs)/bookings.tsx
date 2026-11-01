import { type Href, router, useFocusEffect } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { useMinimizeOnScroll } from "expo-glass-tabs"
import { Text, View } from "react-native"
import Animated from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"

import { BookingDetailSheet } from "@/components/booking/booking-detail-sheet"
import { BookingSessionCard } from "@/components/booking/booking-session-card"
import { JoinedGamesSection } from "@/components/community/joined-games-section"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { Button } from "@/components/ui/button"
import { GlassSegmentControl } from "@/components/ui/glass-segment-control"
import { BookingListSkeleton, SkeletonGate } from "@/components/ui/skeleton"
import { FLOATING_TAB_BAR_CLEARANCE } from "@/constants/navigation-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { fetchMyBookings } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  useProductTheme,
  useSkeletonSurface,
} from "@/hooks/use-product-theme"
import { useSharedBookings } from "@/hooks/use-shared-bookings"
import { communityChatHref } from "@/lib/community-types"
import { toast } from "@/lib/toast"

type BookingFilter = "upcoming" | "past"

export default function BookingsScreen() {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])
  const onScroll = useMinimizeOnScroll()

  const [filter, setFilter] = useState<BookingFilter>("upcoming")
  const [bookings, setBookings] = useState<UserBookingSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  // Games joined as a guest through Community (they aren't your bookings).
  const shared = useSharedBookings()

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
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: FLOATING_TAB_BAR_CLEARANCE },
        ]}
      >
        <Text style={styles.title}>My bookings</Text>

        <GlassSegmentControl
          value={filter}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "past", label: "Past" },
          ]}
          onChange={setFilter}
        />

        {filter === "upcoming" ? (
          <JoinedGamesSection
            bookings={shared.bookings}
            onOpen={(game) => {
              if (game.conversationId) router.push(communityChatHref(game.conversationId) as Href)
            }}
          />
        ) : null}

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
      </Animated.ScrollView>

      <BookingDetailSheet
        visible={selectedBookingId !== null}
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onBookingChanged={() => void loadBookings()}
      />
    </SafeAreaView>
  )
}
