import { router } from "expo-router"
import { useMemo } from "react"
import { RefreshControl, ScrollView } from "react-native"

import { VenueCard } from "@/components/booking/venue-card"
import { HomeHero } from "@/components/home/home-hero"
import { HomeLinksSection } from "@/components/home/home-links-section"
import { NextSessionTicket } from "@/components/home/next-session-ticket"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { HomeTicketSkeleton } from "@/components/ui/skeleton"
import { FLOATING_TAB_BAR_CLEARANCE } from "@/constants/navigation-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import {
  useProductTheme,
  useSkeletonSurface,
} from "@/hooks/use-product-theme"
import type { UserBookingSummary } from "@/lib/booking-types"
import { PRIMARY_VENUE } from "@/lib/venue-assets"

type PlayHomePanelProps = {
  upcomingBooking: UserBookingSummary | null
  secondUpcomingBooking: UserBookingSummary | null
  lastPastBooking: UserBookingSummary | null
  startingPriceLabel: string | null
  isLoadingUpcoming: boolean
  isRefreshing: boolean
  onRefresh: () => void
  onOpenBooking: (bookingId: string) => void
  onOpenCoach?: () => void
}

export function PlayHomePanel({
  upcomingBooking,
  secondUpcomingBooking,
  lastPastBooking,
  startingPriceLabel,
  isLoadingUpcoming,
  isRefreshing,
  onRefresh,
  onOpenBooking,
  onOpenCoach,
}: PlayHomePanelProps) {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])

  const showBookCta = !isLoadingUpcoming && upcomingBooking === null

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scroll,
        {
          gap: PlayTTSpacing.md,
          paddingTop: PlayTTSpacing.md,
          paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
        },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
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
            onPress={() => onOpenBooking(upcomingBooking.id)}
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
        onOpenBooking={onOpenBooking}
        onOpenCoach={onOpenCoach}
      />
    </ScrollView>
  )
}
