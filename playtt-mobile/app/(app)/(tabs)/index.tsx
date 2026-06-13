import { useFocusEffect, useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { CoachHomePanel } from "@/components/coach/coach-home-panel"
import { PlayHomePanel } from "@/components/home/play-home-panel"
import { BookingDetailSheet } from "@/components/booking/booking-detail-sheet"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import {
  HomeSubnav,
  type HomeTab,
} from "@/components/navigation/home-subnav"
import {
  fetchMyBookings,
  fetchStartingPriceHint,
} from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import { useProductTheme } from "@/hooks/use-product-theme"

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

function parseHomeTab(value: string | string[] | undefined): HomeTab {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === "coach" ? "coach" : "play"
}

export default function AppHomeScreen() {
  const theme = useProductTheme()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])
  const { homeTab: homeTabParam } = useLocalSearchParams<{ homeTab?: string }>()
  const [homeTab, setHomeTab] = useState<HomeTab>(() => parseHomeTab(homeTabParam))

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

  useEffect(() => {
    setHomeTab(parseHomeTab(homeTabParam))
  }, [homeTabParam])

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
      if (homeTab === "play") {
        void loadHome()
      }
    }, [homeTab, loadHome]),
  )

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <HomeSubnav value={homeTab} onChange={setHomeTab} />

      <View style={{ flex: 1 }}>
        {homeTab === "play" ? (
          <PlayHomePanel
            upcomingBooking={upcomingBooking}
            secondUpcomingBooking={secondUpcomingBooking}
            lastPastBooking={lastPastBooking}
            startingPriceLabel={startingPriceLabel}
            isLoadingUpcoming={isLoadingUpcoming}
            isRefreshing={isRefreshing}
            onRefresh={() => void loadHome(true)}
            onOpenBooking={setSelectedBookingId}
            onOpenCoach={() => setHomeTab("coach")}
          />
        ) : (
          <CoachHomePanel isActive={homeTab === "coach"} />
        )}
      </View>

      <BookingDetailSheet
        visible={selectedBookingId !== null}
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onBookingChanged={() => void loadHome()}
      />
    </SafeAreaView>
  )
}
