import { router, useFocusEffect } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { RefreshControl, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { HomeHero } from "@/components/home/home-hero"
import { HomeLinksSection } from "@/components/home/home-links-section"
import { NextSessionTicket } from "@/components/home/next-session-ticket"
import { BookingDetailSheet } from "@/components/booking/booking-detail-sheet"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { HomeTicketSkeleton } from "@/components/ui/skeleton"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { fetchMyBookings } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
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
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)

  const loadUpcoming = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true)
    } else {
      setIsLoadingUpcoming(true)
    }

    try {
      const bookings = await fetchMyBookings("upcoming")
      setUpcomingBooking(findUpcomingBooking(bookings))
    } catch {
      setUpcomingBooking(null)
    } finally {
      if (!silent) {
        setIsLoadingUpcoming(false)
      }
      setIsRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadUpcoming()
    }, [loadUpcoming]),
  )

  const showBookCta = !isLoadingUpcoming && upcomingBooking === null

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { gap: PlayTTSpacing.md, paddingBottom: PlayTTSpacing["2xl"] },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadUpcoming(true)}
            tintColor={theme.foreground}
          />
        }
      >
        <HomeHero
          showBookCta={showBookCta}
          onBook={() => router.push("/(app)/book")}
        >
          {isLoadingUpcoming ? (
            <HomeTicketSkeleton surface={skeletonSurface} embedded />
          ) : upcomingBooking ? (
            <NextSessionTicket
              booking={upcomingBooking}
              embedded
              onPress={() => setSelectedBookingId(upcomingBooking.id)}
            />
          ) : null}
        </HomeHero>

        <HomeLinksSection showBookAnother={Boolean(upcomingBooking)} />
      </ScrollView>

      <BookingDetailSheet
        visible={selectedBookingId !== null}
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onBookingChanged={() => void loadUpcoming()}
      />
    </SafeAreaView>
  )
}
