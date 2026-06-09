import { router, useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { BrandMark } from "@/components/brand/brand-mark"
import { Button } from "@/components/ui/button"
import { UpcomingCardSkeleton } from "@/components/ui/skeleton"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { useSession } from "@/lib/auth-client"
import { clearSession } from "@/lib/auth-helpers"
import { fetchMyBookings } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  formatBookingStatus,
  formatTimeRange,
} from "@/lib/booking-utils"

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
  const { data: session } = useSession()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [upcomingBooking, setUpcomingBooking] =
    useState<UserBookingSummary | null>(null)
  const [isLoadingUpcoming, setIsLoadingUpcoming] = useState(true)

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

  async function handleSignOut() {
    setIsSigningOut(true)
    await clearSession()
    router.replace("/?mode=sign-in")
    setIsSigningOut(false)
  }

  const userEmail = session?.user?.email ?? "Signed in"

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <BrandMark size="compact" />
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.description}>Signed in as {userEmail}</Text>

        <Button
          label="Book a session"
          surface="product"
          onPress={() => router.push("/(app)/book")}
        />

        {isLoadingUpcoming ? (
          <UpcomingCardSkeleton surface="dark" />
        ) : upcomingBooking ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(app)/booking/[id]",
                params: { id: upcomingBooking.id },
              })
            }
            style={styles.upcomingCard}
          >
            <Text style={styles.upcomingLabel}>Upcoming booking</Text>
            <Text style={styles.upcomingVenue}>{upcomingBooking.locationName}</Text>
            <Text style={styles.upcomingTime}>
              {formatTimeRange(
                upcomingBooking.startTime,
                upcomingBooking.endTime,
              )}
            </Text>
            <Text style={styles.upcomingStatus}>
              {formatBookingStatus(
                upcomingBooking.status,
                upcomingBooking.paymentStatus,
              )}
            </Text>
          </Pressable>
        ) : null}

        <Button
          label="Sign out"
          variant="outline"
          surface="product"
          onPress={handleSignOut}
          loading={isSigningOut}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PlayTTColors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: PlayTTSpacing.xl,
    paddingTop: PlayTTSpacing.lg,
    gap: PlayTTSpacing.md,
  },
  title: {
    ...PlayTTTypography.headline,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
  },
  description: {
    ...PlayTTTypography.body,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.productMuted,
  },
  upcomingCard: {
    backgroundColor: PlayTTColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PlayTTColors.border,
    padding: PlayTTSpacing.md,
    gap: PlayTTSpacing.xs,
  },
  upcomingLabel: {
    fontSize: 12,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  upcomingVenue: {
    fontSize: 16,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
  },
  upcomingTime: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.medium,
    color: PlayTTColors.foreground,
  },
  upcomingStatus: {
    fontSize: 13,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
  },
})
