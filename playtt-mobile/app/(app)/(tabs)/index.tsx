import { type Href, router, useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import { Linking, RefreshControl } from "react-native"

import { ProfileButton } from "@/components/account/profile-button"
import { BookingDetailSheet } from "@/components/booking/booking-detail-sheet"
import { BookTableCard } from "@/components/home/book-table-card"
import { NextGameCard } from "@/components/home/next-game-card"
import { isRecentGame, RecentGameCard } from "@/components/home/recent-game-card"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { Screen } from "@/components/kit/screen"
import { HomeTicketSkeleton } from "@/components/ui/skeleton"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useProfileSummary } from "@/hooks/use-profile-summary"
import { useSkeletonSurface } from "@/hooks/use-product-theme"
import { fetchMyBookings, fetchStartingPriceHint } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  formatLastSessionLabel,
  formatSecondSessionLabel,
  formatTimeOfDayGreeting,
} from "@/lib/booking-utils"

const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const BOOK_HREF = "/(app)/book" as Href
const COACH_HREF = "/(app)/coach" as Href

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

/** "Good evening, Amina" when we know the name, else just the greeting. */
function greetingFor(firstName: string | null) {
  const greeting = formatTimeOfDayGreeting()
  return firstName ? `${greeting}, ${firstName}` : greeting
}

function openDirections(locationName: string) {
  const query = encodeURIComponent(locationName)
  void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`)
}

/** Play tab — job: show my next game, or help me book one. */
export default function PlayScreen() {
  const { colors } = useAppTheme()
  const skeletonSurface = useSkeletonSurface()
  const [upcomingBooking, setUpcomingBooking] = useState<UserBookingSummary | null>(null)
  const [secondUpcomingBooking, setSecondUpcomingBooking] =
    useState<UserBookingSummary | null>(null)
  const [lastPastBooking, setLastPastBooking] = useState<UserBookingSummary | null>(null)
  const [startingPriceLabel, setStartingPriceLabel] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  // The name only personalises the greeting; until it loads, it's left out.
  const firstName = useProfileSummary()?.name.trim().split(/\s+/)[0] || null

  const loadPlay = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const [upcomingBookings, pastBookings] = await Promise.all([
        fetchMyBookings("upcoming"),
        fetchMyBookings("past"),
      ])

      const upcoming = findUpcomingBookings(upcomingBookings)
      const primary = upcoming[0] ?? null

      setUpcomingBooking(primary)
      setSecondUpcomingBooking(upcoming[1] ?? null)
      setLastPastBooking(findLastPastBooking(pastBookings))
      setStartingPriceLabel(primary ? null : await fetchStartingPriceHint())
    } catch {
      setUpcomingBooking(null)
      setSecondUpcomingBooking(null)
      setLastPastBooking(null)
      setStartingPriceLabel(null)
    } finally {
      if (!silent) setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadPlay()
    }, [loadPlay]),
  )

  const book = () => router.push(BOOK_HREF)
  const showRecentGame = !isLoading && isRecentGame(lastPastBooking)

  return (
    <Screen
      title="Play"
      subtitle={greetingFor(firstName)}
      inTabs
      cornerAccessory={<ProfileButton />}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadPlay(true)}
          tintColor={colors.secondaryLabel}
        />
      }
    >
      {isLoading ? (
        <HomeTicketSkeleton surface={skeletonSurface} />
      ) : upcomingBooking ? (
        <NextGameCard
          booking={upcomingBooking}
          onOpen={() => setSelectedBookingId(upcomingBooking.id)}
          onDirections={() => openDirections(upcomingBooking.locationName)}
        />
      ) : (
        <BookTableCard startingPriceLabel={startingPriceLabel} onBook={book} />
      )}

      {showRecentGame && lastPastBooking ? (
        <RecentGameCard
          booking={lastPastBooking}
          onSeeReplays={() => router.navigate("/(app)/(tabs)/activity")}
        />
      ) : null}

      {!isLoading ? (
        <ListSection header="Shortcuts">
          {upcomingBooking ? (
            <ListRow icon="plus" title="Book another table" onPress={book} />
          ) : null}
          {secondUpcomingBooking ? (
            <ListRow
              icon="calendar"
              title="Your next game after this"
              subtitle={formatSecondSessionLabel(secondUpcomingBooking)}
              onPress={() => setSelectedBookingId(secondUpcomingBooking.id)}
            />
          ) : null}
          {!upcomingBooking && lastPastBooking ? (
            <ListRow
              icon="clock.fill"
              title="Book again"
              subtitle={formatLastSessionLabel(lastPastBooking)}
              onPress={book}
            />
          ) : null}
          <ListRow
            icon="sparkles"
            tone="success"
            title="Coach"
            subtitle="Tips and training from your games"
            onPress={() => router.push(COACH_HREF)}
          />
        </ListSection>
      ) : null}

      <BookingDetailSheet
        visible={selectedBookingId !== null}
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onBookingChanged={() => void loadPlay()}
      />
    </Screen>
  )
}
