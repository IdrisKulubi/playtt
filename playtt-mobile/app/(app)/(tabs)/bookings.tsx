import { type Href, router, useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import { RefreshControl, StyleSheet, View } from "react-native"

import { ProfileButton } from "@/components/account/profile-button"
import { BookingDetailSheet } from "@/components/booking/booking-detail-sheet"
import { Button } from "@/components/kit/button"
import { EmptyState } from "@/components/kit/empty-state"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { Screen } from "@/components/kit/screen"
import { BookingListSkeleton } from "@/components/ui/skeleton"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useSkeletonSurface } from "@/hooks/use-product-theme"
import { useSharedBookings } from "@/hooks/use-shared-bookings"
import { fetchMyBookings } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import { formatTimeRange, needsBookingPayment } from "@/lib/booking-utils"
import { communityChatHref, type CommunitySharedBooking } from "@/lib/community-types"
import { joinedGames } from "@/lib/joined-games"
import { toast } from "@/lib/toast"

const BOOK_HREF = "/(app)/book" as Href

/** Past games scroll in their own box, about three and a half rows tall. */
const PAST_GAMES_MAX_HEIGHT = 340

type ComingUpItem =
  | { kind: "booking"; startsAt: string; booking: UserBookingSummary }
  | { kind: "joined"; startsAt: string; game: CommunitySharedBooking }

/** "Today", "Tomorrow", or "Saturday 14 Nov", like the Calendar app. */
function dayHeading(iso: string, nowMs = Date.now()) {
  const day = new Date(iso)
  day.setHours(0, 0, 0, 0)
  const today = new Date(nowMs)
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  return new Date(iso).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "short" })
}

function groupByDay(items: ComingUpItem[]) {
  const groups: { heading: string; items: ComingUpItem[] }[] = []
  for (const item of items) {
    const heading = dayHeading(item.startsAt)
    const last = groups[groups.length - 1]
    if (last?.heading === heading) last.items.push(item)
    else groups.push({ heading, items: [item] })
  }
  return groups
}

function bookingStatusWord(booking: UserBookingSummary) {
  if (needsBookingPayment(booking)) return "Pay to keep this booking"
  if (booking.status === "cancelled") return "Cancelled"
  if (booking.status === "confirmed" || booking.paymentStatus === "paid") return "Confirmed"
  return "Booked"
}

function formatPastDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })
}

/** Bookings tab — job: see every game I've booked and manage it. */
export default function BookingsScreen() {
  const { colors } = useAppTheme()
  const skeletonSurface = useSkeletonSurface()
  const [upcoming, setUpcoming] = useState<UserBookingSummary[]>([])
  const [past, setPast] = useState<UserBookingSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  // Games joined as a guest through Players (someone else holds the booking).
  const shared = useSharedBookings()

  const loadBookings = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true)
    try {
      const [nextUpcoming, nextPast] = await Promise.all([
        fetchMyBookings("upcoming"),
        fetchMyBookings("past"),
      ])
      setUpcoming(nextUpcoming)
      setPast(nextPast)
    } catch (error) {
      toast.apiError(error, "Could not load your bookings.")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadBookings()
    }, [loadBookings]),
  )

  const comingUp: ComingUpItem[] = [
    ...upcoming.map((booking) => ({ kind: "booking" as const, startsAt: booking.startTime, booking })),
    ...joinedGames(shared.bookings).map((game) => ({ kind: "joined" as const, startsAt: game.startsAt, game })),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  const pastGames = [...past].sort((a, b) => b.startTime.localeCompare(a.startTime))

  const renderItem = (item: ComingUpItem) => {
    if (item.kind === "joined") {
      const { game } = item
      const host = game.partners.find((partner) => partner.id === game.hostId) ?? game.partners[0]
      return (
        <ListRow
          key={`joined-${game.bookingId}`}
          icon="person.2.fill"
          tone="success"
          title={formatTimeRange(game.startsAt, game.endsAt)}
          subtitle={[
            game.phase === "live" ? "Playing now" : "Game with friends",
            host ? `${host.displayName} holds the booking` : null,
            game.resourceName,
          ]
            .filter(Boolean)
            .join(" · ")}
          accessibilityHint="Opens the chat for this game"
          onPress={() => {
            if (game.conversationId) router.push(communityChatHref(game.conversationId) as Href)
          }}
        />
      )
    }

    const { booking } = item
    return (
      <ListRow
        key={booking.id}
        icon={needsBookingPayment(booking) ? "exclamationmark.triangle.fill" : "calendar"}
        tone={needsBookingPayment(booking) ? "warning" : "accent"}
        title={formatTimeRange(booking.startTime, booking.endTime)}
        subtitle={`${bookingStatusWord(booking)} · ${booking.resourceName} · ${booking.groupSize} players`}
        accessibilityHint="Opens the booking"
        onPress={() => setSelectedBookingId(booking.id)}
      />
    )
  }

  return (
    <Screen
      title="Bookings"
      inTabs
      cornerAccessory={<ProfileButton />}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            void loadBookings(true)
            void shared.reload()
          }}
          tintColor={colors.secondaryLabel}
        />
      }
    >
      {isLoading ? (
        <BookingListSkeleton surface={skeletonSurface} />
      ) : (
        <>
          {comingUp.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No games booked yet"
              message="Book a table and your next game shows up here."
              action={{ label: "Book a table", onPress: () => router.push(BOOK_HREF) }}
            />
          ) : (
            <View style={styles.group}>
              {groupByDay(comingUp).map((group) => (
                <ListSection key={group.heading} header={group.heading}>
                  {group.items.map(renderItem)}
                </ListSection>
              ))}
              <Button label="Book another table" variant="secondary" onPress={() => router.push(BOOK_HREF)} />
            </View>
          )}

          {pastGames.length > 0 ? (
            <ListSection header="Past games" maxHeight={PAST_GAMES_MAX_HEIGHT}>
              {pastGames.map((booking) => (
                <ListRow
                  key={booking.id}
                  icon="clock.fill"
                  tone="neutral"
                  title={formatPastDate(booking.startTime)}
                  subtitle={`${formatTimeRange(booking.startTime, booking.endTime)} · ${booking.locationName}`}
                  accessibilityHint="Opens the booking"
                  onPress={() => setSelectedBookingId(booking.id)}
                />
              ))}
            </ListSection>
          ) : null}
        </>
      )}

      <BookingDetailSheet
        visible={selectedBookingId !== null}
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onBookingChanged={() => void loadBookings()}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  group: { gap: PlayTTSpacing.lg },
})
