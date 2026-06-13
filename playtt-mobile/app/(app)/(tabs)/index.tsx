import { router, useFocusEffect } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { RefreshControl, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { HomeHero } from "@/components/home/home-hero"
import { HomeLinksSection } from "@/components/home/home-links-section"
import { NextSessionTicket } from "@/components/home/next-session-ticket"
import { VenueCard } from "@/components/booking/venue-card"
import { BookingDetailSheet } from "@/components/booking/booking-detail-sheet"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { HomeTicketSkeleton } from "@/components/ui/skeleton"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import {
  fetchMyBookings,
  fetchStartingPriceHint,
} from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  useProductTheme,
  useSkeletonSurface,
} from "@/hooks/use-product-theme"
import { PRIMARY_VENUE } from "@/lib/venue-assets"

const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function findUpcomingBookings(bookings: UserBookingSummary[]) {
  const now = Date.now()
  const cutoff = now + UPCOMING_WINDOW_MS

  return bookings
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
    )
}

function findLastPastBooking(bookings: UserBookingSummary[]) {
  const now = Date.now()

  return (
    bookings
      .filter((booking) => new Date(booking.endTime).getTime() < now)
      .sort(
        (left, right) =>
          new Date(right.endTime).getTime() - new Date(left.endTime).getTime(),
      )[0] ?? null
  )
}

export default function AppHomeScreen() {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])

  const [upcomingBooking, setUpcomingBooking] =
    useState<UserBookingSummary | null>(null)
  const [secondUpcomingBooking, setSecondUpcomingBooking] =
    useState<UserBookingSummary | null>(null)
  const [lastPastBooking, setLastPastBooking] =
    useState<UserBookingSummary | null>(null)
  const [startingPriceLabel, setStartingPriceLabel] = useState<string | null>(
    null,
  )
  const [isLoadingUpcoming, setIsLoadingUpcoming] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)

  const loadHome = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true)
    } else {
      setIsLoadingUpcoming(true)
    }

    try {
      const [upcomingBookings, pastBookings] = await Promise.all([
        fetchMyBookings("upcoming"),
        fetchMyBookings("past"),
      ])

      const upcoming = findUpcomingBookings(upcomingBookings)
      const primary = upcoming[0] ?? null
      const secondary = upcoming[1] ?? null

      setUpcomingBooking(primary)
      setSecondUpcomingBooking(secondary)
      setLastPastBooking(findLastPastBooking(pastBookings))

      if (!primary) {
        const priceHint = await fetchStartingPriceHint()
        setStartingPriceLabel(priceHint)
      } else {
        setStartingPriceLabel(null)
      }
    } catch {
      setUpcomingBooking(null)
      setSecondUpcomingBooking(null)
      setLastPastBooking(null)
      setStartingPriceLabel(null)
    } finally {
      if (!silent) {
        setIsLoadingUpcoming(false)
      }
      setIsRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadHome()
    }, [loadHome]),
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
            onRefresh={() => void loadHome(true)}
            tintColor={theme.foreground}
          />
        }
      >
        <HomeHero
          showBookCta={showBookCta}
          startingPriceLabel={startingPriceLabel}
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
          ) : showBookCta ? (
            <VenueCard
              location={PRIMARY_VENUE}
              compact
              onPress={() => router.push("/(app)/book")}
            />
          ) : null}
        </HomeHero>

        <HomeLinksSection
          showBookAnother={Boolean(upcomingBooking)}
          upcomingBooking={upcomingBooking}
          secondUpcomingBooking={secondUpcomingBooking}
          lastPastBooking={lastPastBooking}
          onOpenBooking={setSelectedBookingId}
        />
      </ScrollView>

      <BookingDetailSheet
        visible={selectedBookingId !== null}
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onBookingChanged={() => void loadHome()}
      />
    </SafeAreaView>
  )
}
